import torch
from diffusers import UNet2DConditionModel, StableDiffusionXLPipeline, AutoencoderKL, EulerDiscreteScheduler
from transformers import CLIPVisionModelWithProjection
import inspect

vae = AutoencoderKL.from_pretrained('models/sdxl/vae', torch_dtype=torch.float16)
unet = UNet2DConditionModel.from_config('models/sdxl/unet').to(dtype=torch.float16)
sched = EulerDiscreteScheduler.from_pretrained('models/sdxl/scheduler')
img_enc = CLIPVisionModelWithProjection.from_pretrained('models/studio_sd15/image_encoder', torch_dtype=torch.float16)

pipe = StableDiffusionXLPipeline(
    vae=vae,
    text_encoder=None,
    text_encoder_2=None,
    tokenizer=None,
    tokenizer_2=None,
    unet=unet,
    scheduler=sched,
    image_encoder=img_enc
)

pipe.load_ip_adapter(
    'models/sdxl/ip_adapter',
    subfolder='',
    weight_name='ip-adapter-faceid-plusv2_sdxl.bin',
    image_encoder_folder=None
)

layer = pipe.unet.encoder_hid_proj.image_projection_layers[0]
print('Layer type:', type(layer))
print('Layer forward signature:', inspect.signature(layer.forward))
print('Layer attributes:', [k for k in dir(layer) if not k.startswith('_')][:20])
