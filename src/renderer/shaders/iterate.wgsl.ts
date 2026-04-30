export const ITERATE_SHADER = /* wgsl */`

struct XForm {
  coefs: array<f32, 6>,
  weight: f32,
  color: f32,
  symmetry: f32,
  var_weights: array<f32, 23>,
  julian_power: f32,
  julian_dist: f32,
}

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
@group(0) @binding(1) var<storage, read> xforms: array<XForm>;
@group(0) @binding(2) var<storage, read> palette: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> histogram: array<atomic<u32>>;

fn pcg_random(state: ptr<function, u32>) -> u32 {
  let old = *state;
  *state = *state * 747796405u + 2891336453u;
  let word = ((old >> ((old >> 28u) + 4u)) ^ old) * 277803737u;
  return (word >> 22u) ^ word;
}

fn pcg_random_f32(state: ptr<function, u32>) -> f32 {
  return f32(pcg_random(state)) / 4294967295.0;
}

// __VARIATIONS_PLACEHOLDER__

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= params.num_samples) { return; }

  var seed = (params.thread_offset + gid.x) * 123456789u + 362436069u;

  var px = pcg_random_f32(&seed) * 2.0 - 1.0;
  var py = pcg_random_f32(&seed) * 2.0 - 1.0;
  var pcolor = pcg_random_f32(&seed);

  let fuse = 20u;
  let iters = params.iters_per_thread;

  for (var it = 0u; it < fuse + iters; it++) {
    let rd = pcg_random_f32(&seed);
    var r = rd;

    var fn_idx: u32 = 0u;
    for (var j = 0u; j < params.num_xforms; j++) {
      r = r - xforms[j].weight;
      if (r < 0.0) {
        fn_idx = j;
        break;
      }
      fn_idx = j;
    }

    let xf = xforms[fn_idx];

    let s = xf.symmetry;
    pcolor = (pcolor + xf.color) * 0.5 * (1.0 - s) + s * pcolor;

    let tx = xf.coefs[0] * px + xf.coefs[1] * py + xf.coefs[4];
    let ty = xf.coefs[2] * px + xf.coefs[3] * py + xf.coefs[5];

    var accum = vec2f(0.0, 0.0);

    if (xf.var_weights[0] != 0.0) { variation_linear(tx, ty, xf.var_weights[0], &accum); }
    if (xf.var_weights[1] != 0.0) { variation_sinusoidal(tx, ty, xf.var_weights[1], &accum); }
    if (xf.var_weights[2] != 0.0) { variation_spherical(tx, ty, xf.var_weights[2], &accum); }
    if (xf.var_weights[3] != 0.0) { variation_swirl(tx, ty, xf.var_weights[3], &accum); }
    if (xf.var_weights[4] != 0.0) { variation_horseshoe(tx, ty, xf.var_weights[4], &accum); }
    if (xf.var_weights[5] != 0.0) { variation_polar(tx, ty, xf.var_weights[5], &accum); }
    if (xf.var_weights[6] != 0.0) { variation_handkerchief(tx, ty, xf.var_weights[6], &accum); }
    if (xf.var_weights[7] != 0.0) { variation_heart(tx, ty, xf.var_weights[7], &accum); }
    if (xf.var_weights[8] != 0.0) { variation_disc(tx, ty, xf.var_weights[8], &accum); }
    if (xf.var_weights[9] != 0.0) { variation_spiral(tx, ty, xf.var_weights[9], &accum); }
    if (xf.var_weights[10] != 0.0) { variation_hyperbolic(tx, ty, xf.var_weights[10], &accum); }
    if (xf.var_weights[11] != 0.0) { variation_diamond(tx, ty, xf.var_weights[11], &accum); }
    if (xf.var_weights[12] != 0.0) { variation_ex(tx, ty, xf.var_weights[12], &accum); }
    if (xf.var_weights[13] != 0.0) { variation_julia_builtin(tx, ty, xf.var_weights[13], &seed, &accum); }
    if (xf.var_weights[14] != 0.0) { variation_bent(tx, ty, xf.var_weights[14], &accum); }
    if (xf.var_weights[15] != 0.0) { variation_waves(tx, ty, xf.var_weights[15], xf.coefs[4], xf.coefs[5], xf.coefs[1], xf.coefs[3], &accum); }
    if (xf.var_weights[16] != 0.0) { variation_fisheye(tx, ty, xf.var_weights[16], &accum); }
    if (xf.var_weights[17] != 0.0) { variation_popcorn(tx, ty, xf.var_weights[17], xf.coefs[4], xf.coefs[5], &accum); }
    // Extended variations (index 18-22)
    if (xf.var_weights[18] != 0.0) { variation_julian(tx, ty, xf.var_weights[18], xf.julian_power, xf.julian_dist, &seed, &accum); }
    if (xf.var_weights[19] != 0.0) { variation_bubble(tx, ty, xf.var_weights[19], &accum); }
    if (xf.var_weights[20] != 0.0) { variation_noise(tx, ty, xf.var_weights[20], &seed, &accum); }
    if (xf.var_weights[21] != 0.0) { variation_blur(tx, ty, xf.var_weights[21], &seed, &accum); }
    // pre_blur (index 22) - handled as additive noise before other variations
    if (xf.var_weights[22] != 0.0) {
      let blur_r = pcg_random_f32(&seed);
      let blur_a = pcg_random_f32(&seed) * 2.0 * 3.14159265;
      accum.x += xf.var_weights[22] * blur_r * cos(blur_a);
      accum.y += xf.var_weights[22] * blur_r * sin(blur_a);
    }

    px = accum.x;
    py = accum.y;

    if (it >= fuse) {
      let xp = px - params.center[0];
      let yp = py - params.center[1];

      let nuscale = f32(params.oversample) * params.scale;

      let ix = i32(round((xp * params.cos_angle - yp * params.sin_angle) * nuscale + f32(params.width) * 0.5));
      let iy = i32(round((xp * params.sin_angle + yp * params.cos_angle) * nuscale + f32(params.height) * 0.5));

      if (ix >= 0 && ix < i32(params.width) && iy >= 0 && iy < i32(params.height)) {
        var ci = i32(round(pcolor * 255.0));
        ci = clamp(ci, 0, 255);

        let cmap = palette[u32(ci)];
        let wl = params.white_level;

        atomicAdd(&histogram[(u32(iy) * params.width + u32(ix)) * 4u + 0u], u32(cmap.r * wl));
        atomicAdd(&histogram[(u32(iy) * params.width + u32(ix)) * 4u + 1u], u32(cmap.g * wl));
        atomicAdd(&histogram[(u32(iy) * params.width + u32(ix)) * 4u + 2u], u32(cmap.b * wl));
        atomicAdd(&histogram[(u32(iy) * params.width + u32(ix)) * 4u + 3u], u32(wl));
      }
    }
  }
}
`
