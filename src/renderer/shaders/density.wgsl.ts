export const DENSITY_SHADER = /* wgsl */`

struct Params {
  num_xforms: u32,
  num_samples: u32,
  width: u32,
  height: u32,
  oversample: u32,
  scale: f32,
  center: vec2f,
  cos_angle: f32,
  sin_angle: f32,
  gutter: u32,
  brightness: f32,
  contrast: f32,
  gamma: f32,
  gamma_threshold: f32,
  vibrancy: f32,
  white_level: f32,
  filter_radius: f32,
  prefilter_white: f32,
  bg_r: f32,
  bg_g: f32,
  bg_b: f32,
  out_width: u32,
  out_height: u32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> histogram: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> density: array<vec4f>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x;
  let y = gid.y;
  if (x >= params.width || y >= params.height) { return; }

  let idx = (y * params.width + x) * 4u;
  let cr = atomicLoad(&histogram[idx + 0u]);
  let cg = atomicLoad(&histogram[idx + 1u]);
  let cb = atomicLoad(&histogram[idx + 2u]);
  let ca = atomicLoad(&histogram[idx + 3u]);

  let pix_idx = y * params.width + x;

  if (ca > 0u) {
    let count = f32(ca);
    let k1 = params.contrast * params.brightness * params.prefilter_white * 268.0 / 256.0;

    var scale: f32;
    let out_w = params.out_width;
    let out_h = params.out_height;
    if (3.0 * f32(out_w) < 4.0 * f32(out_h)) {
      scale = (f32(out_w) * params.scale) / 4.0;
    } else {
      scale = (f32(out_h) * params.scale) / 3.0;
    }

    let area = f32(out_h) * f32(out_w) / (scale * scale);
    let k2 = f32(params.oversample * params.oversample) / (params.contrast * area * params.white_level * f32(params.num_samples) / f32(params.width * params.height));

    let ls = k1 * log(1.0 + count * k2) / count;

    density[pix_idx] = vec4f(
      round(f32(cr) * ls + 0.5),
      round(f32(cg) * ls + 0.5),
      round(f32(cb) * ls + 0.5),
      round(count * ls + 0.5),
    );
  } else {
    density[pix_idx] = vec4f(0.0, 0.0, 0.0, 0.0);
  }
}
`
