export const FILTER_SHADER = /* wgsl */`

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
  iters_per_thread: u32,
  thread_offset: u32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> density: array<vec4f>;
@group(0) @binding(2) var<storage, read> gaussian_kernel: array<f32>;
@group(0) @binding(3) var output_tex: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let ox = gid.x;
  let oy = gid.y;

  let out_w = params.out_width;
  let out_h = params.out_height;

  if (ox >= out_w || oy >= out_h) { return; }

  let oversample = params.oversample;
  let filter_width = 2 * i32(round(2.0 * 2.5 * f32(oversample) * params.filter_radius));

  var t = vec4f(0.0, 0.0, 0.0, 0.0);

  if (filter_width > 0) {
    let half_fw = filter_width / 2;
    let sx = i32(ox * oversample) + i32(params.gutter) - half_fw + (i32(oversample) - 1) / 2;
    let sy = i32(oy * oversample) + i32(params.gutter) - half_fw + (i32(oversample) - 1) / 2;

    for (var fy = 0; fy < filter_width; fy++) {
      for (var fx = 0; fx < filter_width; fx++) {
        let ix = sx + fx;
        let iy = sy + fy;
        if (ix >= 0 && ix < i32(params.width) && iy >= 0 && iy < i32(params.height)) {
          let g = gaussian_kernel[u32(fy * filter_width + fx)];
          let d = density[u32(iy) * params.width + u32(ix)];
          t += g * d;
        }
      }
    }
  } else {
    for (var fy = 0u; fy < oversample; fy++) {
      for (var fx = 0u; fx < oversample; fx++) {
        let ix = i32(ox * oversample) + i32(params.gutter) - i32(oversample / 2u) + i32(fx);
        let iy = i32(oy * oversample) + i32(params.gutter) - i32(oversample / 2u) + i32(fy);
        if (ix >= 0 && ix < i32(params.width) && iy >= 0 && iy < i32(params.height)) {
          let d = density[u32(iy) * params.width + u32(ix)];
          t += d / f32(oversample * oversample);
        }
      }
    }
  }

  let g = 1.0 / params.gamma;
  var alpha = t.w;

  var fr: f32 = 0.0;
  var fg: f32 = 0.0;
  var fb: f32 = 0.0;

  if (alpha > 0.0) {
    let nAlpha = alpha / params.prefilter_white;
    let lgs = pow(nAlpha, g - 1.0) / params.prefilter_white;
    alpha = pow(nAlpha, g);
    if (alpha < 0.0) { alpha = 0.0; }
    if (alpha > 1.0) { alpha = 1.0; }

    fr = lgs * t.x;
    fg = lgs * t.y;
    fb = lgs * t.z;
  }

  let inv_alpha = 1.0 - alpha;
  fr = fr + params.bg_r * inv_alpha;
  fg = fg + params.bg_g * inv_alpha;
  fb = fb + params.bg_b * inv_alpha;

  fr = clamp(fr, 0.0, 1.0);
  fg = clamp(fg, 0.0, 1.0);
  fb = clamp(fb, 0.0, 1.0);

  textureStore(output_tex, vec2u(ox, oy), vec4f(fr, fg, fb, alpha));
}
`

export const FILTER_COMPACT_SHADER = /* wgsl */`

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
  iters_per_thread: u32,
  thread_offset: u32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> histogram: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read> gaussian_kernel: array<f32>;
@group(0) @binding(3) var output_tex: texture_storage_2d<rgba8unorm, write>;

fn unpack_density(ix: u32, iy: u32) -> vec4f {
  if (ix >= params.width || iy >= params.height) {
    return vec4f(0.0, 0.0, 0.0, 0.0);
  }

  let base = (iy * params.width + ix) * 2u;
  let packed_rg = atomicLoad(&histogram[base]);
  let packed_bc = atomicLoad(&histogram[base + 1u]);
  let cr = f32((packed_rg >> 16u) & 0xFFFFu);
  let cg = f32(packed_rg & 0xFFFFu);
  let cb = f32((packed_bc >> 16u) & 0xFFFFu);
  let ca = f32(packed_bc & 0xFFFFu);

  if (ca <= 0.0) {
    return vec4f(0.0, 0.0, 0.0, 0.0);
  }

  let count = ca;
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

  return vec4f(
    round(cr * ls + 0.5),
    round(cg * ls + 0.5),
    round(cb * ls + 0.5),
    round(count * ls + 0.5),
  );
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let ox = gid.x;
  let oy = gid.y;

  let out_w = params.out_width;
  let out_h = params.out_height;

  if (ox >= out_w || oy >= out_h) { return; }

  let oversample = params.oversample;
  let filter_width = 2 * i32(round(2.0 * 2.5 * f32(oversample) * params.filter_radius));

  var t = vec4f(0.0, 0.0, 0.0, 0.0);

  if (filter_width > 0) {
    let half_fw = filter_width / 2;
    let sx = i32(ox * oversample) + i32(params.gutter) - half_fw + (i32(oversample) - 1) / 2;
    let sy = i32(oy * oversample) + i32(params.gutter) - half_fw + (i32(oversample) - 1) / 2;

    for (var fy = 0; fy < filter_width; fy++) {
      for (var fx = 0; fx < filter_width; fx++) {
        let ix = sx + fx;
        let iy = sy + fy;
        if (ix >= 0 && ix < i32(params.width) && iy >= 0 && iy < i32(params.height)) {
          let g = gaussian_kernel[u32(fy * filter_width + fx)];
          let d = unpack_density(u32(ix), u32(iy));
          t += g * d;
        }
      }
    }
  } else {
    for (var fy = 0u; fy < oversample; fy++) {
      for (var fx = 0u; fx < oversample; fx++) {
        let ix = i32(ox * oversample) + i32(params.gutter) - i32(oversample / 2u) + i32(fx);
        let iy = i32(oy * oversample) + i32(params.gutter) - i32(oversample / 2u) + i32(fy);
        if (ix >= 0 && ix < i32(params.width) && iy >= 0 && iy < i32(params.height)) {
          let d = unpack_density(u32(ix), u32(iy));
          t += d / f32(oversample * oversample);
        }
      }
    }
  }

  let g = 1.0 / params.gamma;
  var alpha = t.w;

  var fr: f32 = 0.0;
  var fg: f32 = 0.0;
  var fb: f32 = 0.0;

  if (alpha > 0.0) {
    let nAlpha = alpha / params.prefilter_white;
    let lgs = pow(nAlpha, g - 1.0) / params.prefilter_white;
    alpha = pow(nAlpha, g);
    if (alpha < 0.0) { alpha = 0.0; }
    if (alpha > 1.0) { alpha = 1.0; }

    fr = lgs * t.x;
    fg = lgs * t.y;
    fb = lgs * t.z;
  }

  let inv_alpha = 1.0 - alpha;
  fr = fr + params.bg_r * inv_alpha;
  fg = fg + params.bg_g * inv_alpha;
  fb = fb + params.bg_b * inv_alpha;

  fr = clamp(fr, 0.0, 1.0);
  fg = clamp(fg, 0.0, 1.0);
  fb = clamp(fb, 0.0, 1.0);

  textureStore(output_tex, vec2u(ox, oy), vec4f(fr, fg, fb, alpha));
}
`
