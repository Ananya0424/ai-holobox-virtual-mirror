#!/usr/bin/env python3
"""
Persistent Local GPU Worker for Holobox AI Transformation.
Keeps U2-Net ONNX + Stable Diffusion 1.5 Inpainting warm in memory
across consecutive users, exposes real-time step progress, and handles
GPU OOM / runtime errors cleanly without restarting the process.
"""

import os
import sys
import json
import time
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ai_transform import AIStudioEngine

PORT = int(os.environ.get("HOLOBOX_AI_PORT", "5055"))

ENGINE = AIStudioEngine(models_dir=os.path.abspath("models"))
GPU_LOCK = threading.Lock()
JOBS = {}
JOBS_LOCK = threading.Lock()


def update_job(job_id, **kwargs):
    with JOBS_LOCK:
        if job_id in JOBS:
            JOBS[job_id].update(kwargs)


def run_job(job_id, payload):
    update_job(job_id, status="queued", progress=5, stepLabel="Waiting for GPU queue...")
    with GPU_LOCK:
        try:
            update_job(job_id, status="running", progress=8, stepLabel="Loading / warming local AI models...")

            def progress_cb(pct, label):
                update_job(job_id, status="running", progress=int(pct), stepLabel=label)

            res = ENGINE.transform(
                input_source=payload["inputPath"],
                profession_raw=payload.get("profession", "doctor"),
                gender=payload.get("gender", "female"),
                output_path=payload["outputPath"],
                custom_prompt=payload.get("customPrompt"),
                progress_callback=progress_cb,
            )
            update_job(
                job_id,
                status="done",
                progress=100,
                stepLabel="Studio portrait ready!",
                result=res,
            )
        except Exception as err:
            traceback.print_exc(file=sys.stderr)
            update_job(
                job_id,
                status="error",
                progress=0,
                stepLabel="Transformation failed",
                error=str(err),
            )


class WorkerHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Keep stdout clean; log errors only if needed
        pass

    def _send_json(self, code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {
                "ok": True,
                "modelsLoaded": ENGINE.sd_pipe is not None,
                "modelLoadTime": round(ENGINE.model_load_time, 2),
                "device": ENGINE.device,
            })
            return

        if self.path.startswith("/status/"):
            job_id = self.path.split("/status/", 1)[1].strip()
            with JOBS_LOCK:
                job = JOBS.get(job_id)
            if not job:
                self._send_json(404, {"error": "Job not found"})
            else:
                self._send_json(200, job)
            return

        self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        if self.path == "/transform":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(length).decode("utf-8")
                payload = json.loads(raw or "{}")
                job_id = payload.get("jobId") or str(int(time.time() * 1000))

                with JOBS_LOCK:
                    JOBS[job_id] = {
                        "jobId": job_id,
                        "status": "queued",
                        "progress": 4,
                        "stepLabel": "Initializing transformation...",
                    }

                t = threading.Thread(target=run_job, args=(job_id, payload), daemon=True)
                t.start()
                self._send_json(202, {"accepted": True, "jobId": job_id})
            except Exception as err:
                self._send_json(500, {"error": str(err)})
            return

        self._send_json(404, {"error": "Not found"})


def main():
    print(f"[AIWorker] Starting persistent GPU worker on 127.0.0.1:{PORT}...")
    # Preload models at startup so first user has minimal latency
    try:
        ENGINE.load_models()
    except Exception as e:
        print(f"[AIWorker] Warning: preload deferred ({e})", file=sys.stderr)

    server = ThreadingHTTPServer(("127.0.0.1", PORT), WorkerHandler)
    print(f"[AIWorker] Listening on http://127.0.0.1:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
