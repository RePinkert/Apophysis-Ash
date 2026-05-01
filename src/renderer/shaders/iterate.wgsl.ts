export const ITERATE_SHADER = /* wgsl */`

struct XForm {
  coefs: array<f32, 6>,
  weight: f32,
  color: f32,
  symmetry: f32,
  var_weights: array<f32, 50>,
  julian_power: f32,
  julian_dist: f32,
  rings_coeff: f32,
  fan_dist: f32,
  blob_low: f32,
  blob_high: f32,
  blob_waves: f32,
  pdj1: f32,
  pdj2: f32,
  pdj3: f32,
  pdj4: f32,
  perspective_angle: f32,
  perspective_dist: f32,
  ngon_power: f32,
  ngon_sides: f32,
  ngon_corners: f32,
  ngon_circle: f32,
  curl_c1: f32,
  curl_c2: f32,
  bipolar_shift: f32,
  cell_size: f32,
  crackle_seed: f32,
  crackle_scale: f32,
  crackle_z: f32,
  crackle_spreadx: f32,
  crackle_spready: f32,
  juliascope_power: f32,
  juliascope_dist: f32,
  split_xsize: f32,
  split_ysize: f32,
  wedge_angle: f32,
  wedge_hole: f32,
  wedge_count: f32,
  wedge_swirl: f32,
  wedge_julia_power: f32,
  wedge_julia_angle: f32,
  wedge_julia_count: f32,
  wedge_julia_dist: f32,
  wedge_sph_angle: f32,
  wedge_sph_hole: f32,
  wedge_sph_count: f32,
  wedge_sph_swirl: f32,
  bwraps_cellsize: f32,
  bwraps_space: f32,
  bwraps_gain: f32,
  bwraps_innerTwist: f32,
  bwraps_outerTwist: f32,
  bwraps7_cellsize: f32,
  bwraps7_space: f32,
  bwraps7_gain: f32,
  bwraps7_innerTwist: f32,
  bwraps7_outerTwist: f32,
  motion_blur_angle: f32,
  motion_blur_length: f32,
  radial_blur_angle: f32,
  post: array<f32, 6>,
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
  has_final_xform: u32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> xforms: array<XForm>;
@group(0) @binding(2) var<storage, read> palette: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> histogram: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read> final_xform: XForm;

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
    if (xf.var_weights[18] != 0.0) { variation_julian(tx, ty, xf.var_weights[18], xf.julian_power, xf.julian_dist, &seed, &accum); }
    if (xf.var_weights[19] != 0.0) { variation_bubble(tx, ty, xf.var_weights[19], &accum); }
    if (xf.var_weights[20] != 0.0) { variation_noise(tx, ty, xf.var_weights[20], &seed, &accum); }
    if (xf.var_weights[21] != 0.0) { variation_blur(tx, ty, xf.var_weights[21], &seed, &accum); }
    if (xf.var_weights[22] != 0.0) {
      let blur_r = pcg_random_f32(&seed);
      let blur_a = pcg_random_f32(&seed) * 2.0 * 3.14159265;
      accum.x += xf.var_weights[22] * blur_r * cos(blur_a);
      accum.y += xf.var_weights[22] * blur_r * sin(blur_a);
    }
    if (xf.var_weights[23] != 0.0) { variation_exponential(tx, ty, xf.var_weights[23], &accum); }
    if (xf.var_weights[24] != 0.0) { variation_power(tx, ty, xf.var_weights[24], &accum); }
    if (xf.var_weights[25] != 0.0) { variation_cosine(tx, ty, xf.var_weights[25], &accum); }
    if (xf.var_weights[26] != 0.0) { variation_rings(tx, ty, xf.var_weights[26], xf.rings_coeff, &accum); }
    if (xf.var_weights[27] != 0.0) { variation_fan(tx, ty, xf.var_weights[27], xf.fan_dist, &accum); }
    if (xf.var_weights[28] != 0.0) { variation_blob(tx, ty, xf.var_weights[28], xf.blob_low, xf.blob_high, xf.blob_waves, &accum); }
    if (xf.var_weights[29] != 0.0) { variation_pdj(tx, ty, xf.var_weights[29], xf.pdj1, xf.pdj2, xf.pdj3, xf.pdj4, &accum); }
    if (xf.var_weights[30] != 0.0) { variation_perspective(tx, ty, xf.var_weights[30], xf.perspective_angle, xf.perspective_dist, &accum); }
    if (xf.var_weights[31] != 0.0) { variation_ngon(tx, ty, xf.var_weights[31], xf.ngon_power, xf.ngon_sides, xf.ngon_corners, xf.ngon_circle, &accum); }
    if (xf.var_weights[32] != 0.0) { variation_curl(tx, ty, xf.var_weights[32], xf.curl_c1, xf.curl_c2, &accum); }
    if (xf.var_weights[33] != 0.0) { variation_bipolar(tx, ty, xf.var_weights[33], xf.bipolar_shift, &accum); }
    if (xf.var_weights[34] != 0.0) { variation_elliptic(tx, ty, xf.var_weights[34], &accum); }
    if (xf.var_weights[35] != 0.0) { variation_cell(tx, ty, xf.var_weights[35], xf.cell_size, &accum); }
    if (xf.var_weights[36] != 0.0) { variation_crackle(tx, ty, xf.var_weights[36], xf.crackle_scale, xf.crackle_z, xf.crackle_spreadx, xf.crackle_spready, &seed, &accum); }
    if (xf.var_weights[37] != 0.0) { variation_juliascope(tx, ty, xf.var_weights[37], xf.juliascope_power, xf.juliascope_dist, &seed, &accum); }
    if (xf.var_weights[38] != 0.0) { variation_split(tx, ty, xf.var_weights[38], xf.split_xsize, xf.split_ysize, &accum); }
    if (xf.var_weights[39] != 0.0) { variation_wedge(tx, ty, xf.var_weights[39], xf.wedge_angle, xf.wedge_hole, xf.wedge_count, xf.wedge_swirl, &accum); }
    if (xf.var_weights[40] != 0.0) { variation_wedge_julia(tx, ty, xf.var_weights[40], xf.wedge_julia_power, xf.wedge_julia_angle, xf.wedge_julia_count, xf.wedge_julia_dist, &seed, &accum); }
    if (xf.var_weights[41] != 0.0) { variation_wedge_sph(tx, ty, xf.var_weights[41], xf.wedge_sph_angle, xf.wedge_sph_hole, xf.wedge_sph_count, xf.wedge_sph_swirl, &accum); }
    if (xf.var_weights[42] != 0.0) { variation_bwraps(tx, ty, xf.var_weights[42], xf.bwraps_cellsize, xf.bwraps_space, xf.bwraps_gain, xf.bwraps_innerTwist, xf.bwraps_outerTwist, &accum); }
    if (xf.var_weights[43] != 0.0) { variation_bwraps7(tx, ty, xf.var_weights[43], xf.bwraps7_cellsize, xf.bwraps7_space, xf.bwraps7_gain, xf.bwraps7_innerTwist, xf.bwraps7_outerTwist, &accum); }
    if (xf.var_weights[44] != 0.0) { variation_motion_blur(tx, ty, xf.var_weights[44], xf.motion_blur_angle, xf.motion_blur_length, &seed, &accum); }
    if (xf.var_weights[45] != 0.0) { variation_zblur(tx, ty, xf.var_weights[45], &seed, &accum); }
    if (xf.var_weights[46] != 0.0) { variation_gaussian_blur(tx, ty, xf.var_weights[46], &seed, &accum); }
    if (xf.var_weights[47] != 0.0) { variation_radial_blur(tx, ty, xf.var_weights[47], xf.radial_blur_angle, &seed, &accum); }

    px = accum.x;
    py = accum.y;

    // Post-transform rotations (post_rotate_x, post_rotate_y)
    if (xf.var_weights[48] != 0.0) {
      let angle = xf.var_weights[48];
      let cos_a = cos(angle);
      let sin_a = sin(angle);
      let new_y = py * cos_a - sin_a;
      let new_z = py * sin_a + cos_a;
      py = new_y / (new_z + 1.0);
    }
    if (xf.var_weights[49] != 0.0) {
      let angle = xf.var_weights[49];
      let cos_a = cos(angle);
      let sin_a = sin(angle);
      let new_x = px * cos_a + sin_a;
      let new_z = -px * sin_a + cos_a;
      px = new_x / (new_z + 1.0);
    }

    // Apply post-affine transform
    let post_npx = xf.post[0] * px + xf.post[1] * py + xf.post[4];
    let post_npy = xf.post[2] * px + xf.post[3] * py + xf.post[5];
    px = post_npx;
    py = post_npy;

    if (it >= fuse) {
      // Apply final transform if present
      if (params.has_final_xform != 0u) {
        let ffx = final_xform;
        let ftx = ffx.coefs[0] * px + ffx.coefs[1] * py + ffx.coefs[4];
        let fty = ffx.coefs[2] * px + ffx.coefs[3] * py + ffx.coefs[5];
        var faccum = vec2f(0.0, 0.0);

        if (ffx.var_weights[0] != 0.0) { variation_linear(ftx, fty, ffx.var_weights[0], &faccum); }
        if (ffx.var_weights[1] != 0.0) { variation_sinusoidal(ftx, fty, ffx.var_weights[1], &faccum); }
        if (ffx.var_weights[2] != 0.0) { variation_spherical(ftx, fty, ffx.var_weights[2], &faccum); }
        if (ffx.var_weights[3] != 0.0) { variation_swirl(ftx, fty, ffx.var_weights[3], &faccum); }
        if (ffx.var_weights[4] != 0.0) { variation_horseshoe(ftx, fty, ffx.var_weights[4], &faccum); }
        if (ffx.var_weights[5] != 0.0) { variation_polar(ftx, fty, ffx.var_weights[5], &faccum); }
        if (ffx.var_weights[6] != 0.0) { variation_handkerchief(ftx, fty, ffx.var_weights[6], &faccum); }
        if (ffx.var_weights[7] != 0.0) { variation_heart(ftx, fty, ffx.var_weights[7], &faccum); }
        if (ffx.var_weights[8] != 0.0) { variation_disc(ftx, fty, ffx.var_weights[8], &faccum); }
        if (ffx.var_weights[9] != 0.0) { variation_spiral(ftx, fty, ffx.var_weights[9], &faccum); }
        if (ffx.var_weights[10] != 0.0) { variation_hyperbolic(ftx, fty, ffx.var_weights[10], &faccum); }
        if (ffx.var_weights[11] != 0.0) { variation_diamond(ftx, fty, ffx.var_weights[11], &faccum); }
        if (ffx.var_weights[12] != 0.0) { variation_ex(ftx, fty, ffx.var_weights[12], &faccum); }
        if (ffx.var_weights[13] != 0.0) { variation_julia_builtin(ftx, fty, ffx.var_weights[13], &seed, &faccum); }
        if (ffx.var_weights[14] != 0.0) { variation_bent(ftx, fty, ffx.var_weights[14], &faccum); }
        if (ffx.var_weights[15] != 0.0) { variation_waves(ftx, fty, ffx.var_weights[15], ffx.coefs[4], ffx.coefs[5], ffx.coefs[1], ffx.coefs[3], &faccum); }
        if (ffx.var_weights[16] != 0.0) { variation_fisheye(ftx, fty, ffx.var_weights[16], &faccum); }
        if (ffx.var_weights[17] != 0.0) { variation_popcorn(ftx, fty, ffx.var_weights[17], ffx.coefs[4], ffx.coefs[5], &faccum); }
        if (ffx.var_weights[18] != 0.0) { variation_julian(ftx, fty, ffx.var_weights[18], ffx.julian_power, ffx.julian_dist, &seed, &faccum); }
        if (ffx.var_weights[19] != 0.0) { variation_bubble(ftx, fty, ffx.var_weights[19], &faccum); }
        if (ffx.var_weights[20] != 0.0) { variation_noise(ftx, fty, ffx.var_weights[20], &seed, &faccum); }
        if (ffx.var_weights[21] != 0.0) { variation_blur(ftx, fty, ffx.var_weights[21], &seed, &faccum); }
        if (ffx.var_weights[22] != 0.0) {
          let blur_r = pcg_random_f32(&seed);
          let blur_a = pcg_random_f32(&seed) * 2.0 * 3.14159265;
          faccum.x += ffx.var_weights[22] * blur_r * cos(blur_a);
          faccum.y += ffx.var_weights[22] * blur_r * sin(blur_a);
        }
        if (ffx.var_weights[23] != 0.0) { variation_exponential(ftx, fty, ffx.var_weights[23], &faccum); }
        if (ffx.var_weights[24] != 0.0) { variation_power(ftx, fty, ffx.var_weights[24], &faccum); }
        if (ffx.var_weights[25] != 0.0) { variation_cosine(ftx, fty, ffx.var_weights[25], &faccum); }
        if (ffx.var_weights[26] != 0.0) { variation_rings(ftx, fty, ffx.var_weights[26], ffx.rings_coeff, &faccum); }
        if (ffx.var_weights[27] != 0.0) { variation_fan(ftx, fty, ffx.var_weights[27], ffx.fan_dist, &faccum); }
        if (ffx.var_weights[28] != 0.0) { variation_blob(ftx, fty, ffx.var_weights[28], ffx.blob_low, ffx.blob_high, ffx.blob_waves, &faccum); }
        if (ffx.var_weights[29] != 0.0) { variation_pdj(ftx, fty, ffx.var_weights[29], ffx.pdj1, ffx.pdj2, ffx.pdj3, ffx.pdj4, &faccum); }
        if (ffx.var_weights[30] != 0.0) { variation_perspective(ftx, fty, ffx.var_weights[30], ffx.perspective_angle, ffx.perspective_dist, &faccum); }
        if (ffx.var_weights[31] != 0.0) { variation_ngon(ftx, fty, ffx.var_weights[31], ffx.ngon_power, ffx.ngon_sides, ffx.ngon_corners, ffx.ngon_circle, &faccum); }
        if (ffx.var_weights[32] != 0.0) { variation_curl(ftx, fty, ffx.var_weights[32], ffx.curl_c1, ffx.curl_c2, &faccum); }
        if (ffx.var_weights[33] != 0.0) { variation_bipolar(ftx, fty, ffx.var_weights[33], ffx.bipolar_shift, &faccum); }
        if (ffx.var_weights[34] != 0.0) { variation_elliptic(ftx, fty, ffx.var_weights[34], &faccum); }
        if (ffx.var_weights[35] != 0.0) { variation_cell(ftx, fty, ffx.var_weights[35], ffx.cell_size, &faccum); }
        if (ffx.var_weights[36] != 0.0) { variation_crackle(ftx, fty, ffx.var_weights[36], ffx.crackle_scale, ffx.crackle_z, ffx.crackle_spreadx, ffx.crackle_spready, &seed, &faccum); }
        if (ffx.var_weights[37] != 0.0) { variation_juliascope(ftx, fty, ffx.var_weights[37], ffx.juliascope_power, ffx.juliascope_dist, &seed, &faccum); }
        if (ffx.var_weights[38] != 0.0) { variation_split(ftx, fty, ffx.var_weights[38], ffx.split_xsize, ffx.split_ysize, &faccum); }
        if (ffx.var_weights[39] != 0.0) { variation_wedge(ftx, fty, ffx.var_weights[39], ffx.wedge_angle, ffx.wedge_hole, ffx.wedge_count, ffx.wedge_swirl, &faccum); }
        if (ffx.var_weights[40] != 0.0) { variation_wedge_julia(ftx, fty, ffx.var_weights[40], ffx.wedge_julia_power, ffx.wedge_julia_angle, ffx.wedge_julia_count, ffx.wedge_julia_dist, &seed, &faccum); }
        if (ffx.var_weights[41] != 0.0) { variation_wedge_sph(ftx, fty, ffx.var_weights[41], ffx.wedge_sph_angle, ffx.wedge_sph_hole, ffx.wedge_sph_count, ffx.wedge_sph_swirl, &faccum); }
        if (ffx.var_weights[42] != 0.0) { variation_bwraps(ftx, fty, ffx.var_weights[42], ffx.bwraps_cellsize, ffx.bwraps_space, ffx.bwraps_gain, ffx.bwraps_innerTwist, ffx.bwraps_outerTwist, &faccum); }
        if (ffx.var_weights[43] != 0.0) { variation_bwraps7(ftx, fty, ffx.var_weights[43], ffx.bwraps7_cellsize, ffx.bwraps7_space, ffx.bwraps7_gain, ffx.bwraps7_innerTwist, ffx.bwraps7_outerTwist, &faccum); }
        if (ffx.var_weights[44] != 0.0) { variation_motion_blur(ftx, fty, ffx.var_weights[44], ffx.motion_blur_angle, ffx.motion_blur_length, &seed, &faccum); }
        if (ffx.var_weights[45] != 0.0) { variation_zblur(ftx, fty, ffx.var_weights[45], &seed, &faccum); }
        if (ffx.var_weights[46] != 0.0) { variation_gaussian_blur(ftx, fty, ffx.var_weights[46], &seed, &faccum); }
        if (ffx.var_weights[47] != 0.0) { variation_radial_blur(ftx, fty, ffx.var_weights[47], ffx.radial_blur_angle, &seed, &faccum); }

        px = faccum.x;
        py = faccum.y;

        // Post-rotate for final xform
        if (ffx.var_weights[48] != 0.0) {
          let angle = ffx.var_weights[48];
          let cos_a = cos(angle);
          let sin_a = sin(angle);
          let new_y = py * cos_a - sin_a;
          let new_z = py * sin_a + cos_a;
          py = new_y / (new_z + 1.0);
        }
        if (ffx.var_weights[49] != 0.0) {
          let angle = ffx.var_weights[49];
          let cos_a = cos(angle);
          let sin_a = sin(angle);
          let new_x = px * cos_a + sin_a;
          let new_z = -px * sin_a + cos_a;
          px = new_x / (new_z + 1.0);
        }

        // Post-affine of final xform
        let fpost_npx = ffx.post[0] * px + ffx.post[1] * py + ffx.post[4];
        let fpost_npy = ffx.post[2] * px + ffx.post[3] * py + ffx.post[5];
        px = fpost_npx;
        py = fpost_npy;
      }

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

export const ITERATE_COMPACT_SHADER = /* wgsl */`

struct XForm {
  coefs: array<f32, 6>,
  weight: f32,
  color: f32,
  symmetry: f32,
  var_weights: array<f32, 50>,
  julian_power: f32,
  julian_dist: f32,
  rings_coeff: f32,
  fan_dist: f32,
  blob_low: f32,
  blob_high: f32,
  blob_waves: f32,
  pdj1: f32,
  pdj2: f32,
  pdj3: f32,
  pdj4: f32,
  perspective_angle: f32,
  perspective_dist: f32,
  ngon_power: f32,
  ngon_sides: f32,
  ngon_corners: f32,
  ngon_circle: f32,
  curl_c1: f32,
  curl_c2: f32,
  bipolar_shift: f32,
  cell_size: f32,
  crackle_seed: f32,
  crackle_scale: f32,
  crackle_z: f32,
  crackle_spreadx: f32,
  crackle_spready: f32,
  juliascope_power: f32,
  juliascope_dist: f32,
  split_xsize: f32,
  split_ysize: f32,
  wedge_angle: f32,
  wedge_hole: f32,
  wedge_count: f32,
  wedge_swirl: f32,
  wedge_julia_power: f32,
  wedge_julia_angle: f32,
  wedge_julia_count: f32,
  wedge_julia_dist: f32,
  wedge_sph_angle: f32,
  wedge_sph_hole: f32,
  wedge_sph_count: f32,
  wedge_sph_swirl: f32,
  bwraps_cellsize: f32,
  bwraps_space: f32,
  bwraps_gain: f32,
  bwraps_innerTwist: f32,
  bwraps_outerTwist: f32,
  bwraps7_cellsize: f32,
  bwraps7_space: f32,
  bwraps7_gain: f32,
  bwraps7_innerTwist: f32,
  bwraps7_outerTwist: f32,
  motion_blur_angle: f32,
  motion_blur_length: f32,
  radial_blur_angle: f32,
  post: array<f32, 6>,
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
  has_final_xform: u32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> xforms: array<XForm>;
@group(0) @binding(2) var<storage, read> palette: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> histogram: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read> final_xform: XForm;

fn pcg_random(state: ptr<function, u32>) -> u32 {
  let old = *state;
  *state = *state * 747796405u + 2891336453u;
  let word = ((old >> ((old >> 28u) + 4u)) ^ old) * 277803737u;
  return (word >> 22u) ^ word;
}

fn pcg_random_f32(state: ptr<function, u32>) -> f32 {
  return f32(pcg_random(state)) / 4294967295.0;
}

fn atomicAddSaturate16(addr: ptr<storage, atomic<u32>, read_write>, hi_shift: u32, hi_val: u32, lo_val: u32) {
  var old = atomicLoad(addr);
  loop {
    var hi = (old >> hi_shift) & 0xFFFFu;
    var lo = old & 0xFFFFu;
    hi = min(hi + hi_val, 0xFFFFu);
    lo = min(lo + lo_val, 0xFFFFu);
    let new_val = (hi << hi_shift) | lo;
    let result = atomicCompareExchangeWeak(addr, old, new_val);
    if (result.exchanged) { break; }
    old = result.old_value;
  }
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
    if (xf.var_weights[18] != 0.0) { variation_julian(tx, ty, xf.var_weights[18], xf.julian_power, xf.julian_dist, &seed, &accum); }
    if (xf.var_weights[19] != 0.0) { variation_bubble(tx, ty, xf.var_weights[19], &accum); }
    if (xf.var_weights[20] != 0.0) { variation_noise(tx, ty, xf.var_weights[20], &seed, &accum); }
    if (xf.var_weights[21] != 0.0) { variation_blur(tx, ty, xf.var_weights[21], &seed, &accum); }
    if (xf.var_weights[22] != 0.0) {
      let blur_r = pcg_random_f32(&seed);
      let blur_a = pcg_random_f32(&seed) * 2.0 * 3.14159265;
      accum.x += xf.var_weights[22] * blur_r * cos(blur_a);
      accum.y += xf.var_weights[22] * blur_r * sin(blur_a);
    }
    if (xf.var_weights[23] != 0.0) { variation_exponential(tx, ty, xf.var_weights[23], &accum); }
    if (xf.var_weights[24] != 0.0) { variation_power(tx, ty, xf.var_weights[24], &accum); }
    if (xf.var_weights[25] != 0.0) { variation_cosine(tx, ty, xf.var_weights[25], &accum); }
    if (xf.var_weights[26] != 0.0) { variation_rings(tx, ty, xf.var_weights[26], xf.rings_coeff, &accum); }
    if (xf.var_weights[27] != 0.0) { variation_fan(tx, ty, xf.var_weights[27], xf.fan_dist, &accum); }
    if (xf.var_weights[28] != 0.0) { variation_blob(tx, ty, xf.var_weights[28], xf.blob_low, xf.blob_high, xf.blob_waves, &accum); }
    if (xf.var_weights[29] != 0.0) { variation_pdj(tx, ty, xf.var_weights[29], xf.pdj1, xf.pdj2, xf.pdj3, xf.pdj4, &accum); }
    if (xf.var_weights[30] != 0.0) { variation_perspective(tx, ty, xf.var_weights[30], xf.perspective_angle, xf.perspective_dist, &accum); }
    if (xf.var_weights[31] != 0.0) { variation_ngon(tx, ty, xf.var_weights[31], xf.ngon_power, xf.ngon_sides, xf.ngon_corners, xf.ngon_circle, &accum); }
    if (xf.var_weights[32] != 0.0) { variation_curl(tx, ty, xf.var_weights[32], xf.curl_c1, xf.curl_c2, &accum); }
    if (xf.var_weights[33] != 0.0) { variation_bipolar(tx, ty, xf.var_weights[33], xf.bipolar_shift, &accum); }
    if (xf.var_weights[34] != 0.0) { variation_elliptic(tx, ty, xf.var_weights[34], &accum); }
    if (xf.var_weights[35] != 0.0) { variation_cell(tx, ty, xf.var_weights[35], xf.cell_size, &accum); }
    if (xf.var_weights[36] != 0.0) { variation_crackle(tx, ty, xf.var_weights[36], xf.crackle_scale, xf.crackle_z, xf.crackle_spreadx, xf.crackle_spready, &seed, &accum); }
    if (xf.var_weights[37] != 0.0) { variation_juliascope(tx, ty, xf.var_weights[37], xf.juliascope_power, xf.juliascope_dist, &seed, &accum); }
    if (xf.var_weights[38] != 0.0) { variation_split(tx, ty, xf.var_weights[38], xf.split_xsize, xf.split_ysize, &accum); }
    if (xf.var_weights[39] != 0.0) { variation_wedge(tx, ty, xf.var_weights[39], xf.wedge_angle, xf.wedge_hole, xf.wedge_count, xf.wedge_swirl, &accum); }
    if (xf.var_weights[40] != 0.0) { variation_wedge_julia(tx, ty, xf.var_weights[40], xf.wedge_julia_power, xf.wedge_julia_angle, xf.wedge_julia_count, xf.wedge_julia_dist, &seed, &accum); }
    if (xf.var_weights[41] != 0.0) { variation_wedge_sph(tx, ty, xf.var_weights[41], xf.wedge_sph_angle, xf.wedge_sph_hole, xf.wedge_sph_count, xf.wedge_sph_swirl, &accum); }
    if (xf.var_weights[42] != 0.0) { variation_bwraps(tx, ty, xf.var_weights[42], xf.bwraps_cellsize, xf.bwraps_space, xf.bwraps_gain, xf.bwraps_innerTwist, xf.bwraps_outerTwist, &accum); }
    if (xf.var_weights[43] != 0.0) { variation_bwraps7(tx, ty, xf.var_weights[43], xf.bwraps7_cellsize, xf.bwraps7_space, xf.bwraps7_gain, xf.bwraps7_innerTwist, xf.bwraps7_outerTwist, &accum); }
    if (xf.var_weights[44] != 0.0) { variation_motion_blur(tx, ty, xf.var_weights[44], xf.motion_blur_angle, xf.motion_blur_length, &seed, &accum); }
    if (xf.var_weights[45] != 0.0) { variation_zblur(tx, ty, xf.var_weights[45], &seed, &accum); }
    if (xf.var_weights[46] != 0.0) { variation_gaussian_blur(tx, ty, xf.var_weights[46], &seed, &accum); }
    if (xf.var_weights[47] != 0.0) { variation_radial_blur(tx, ty, xf.var_weights[47], xf.radial_blur_angle, &seed, &accum); }

    px = accum.x;
    py = accum.y;

    // Post-transform rotations (post_rotate_x, post_rotate_y)
    if (xf.var_weights[48] != 0.0) {
      let angle = xf.var_weights[48];
      let cos_a = cos(angle);
      let sin_a = sin(angle);
      let new_y = py * cos_a - sin_a;
      let new_z = py * sin_a + cos_a;
      py = new_y / (new_z + 1.0);
    }
    if (xf.var_weights[49] != 0.0) {
      let angle = xf.var_weights[49];
      let cos_a = cos(angle);
      let sin_a = sin(angle);
      let new_x = px * cos_a + sin_a;
      let new_z = -px * sin_a + cos_a;
      px = new_x / (new_z + 1.0);
    }

    // Apply post-affine transform
    let post_npx = xf.post[0] * px + xf.post[1] * py + xf.post[4];
    let post_npy = xf.post[2] * px + xf.post[3] * py + xf.post[5];
    px = post_npx;
    py = post_npy;

    if (it >= fuse) {
      // Apply final transform if present
      if (params.has_final_xform != 0u) {
        let ffx = final_xform;
        let ftx = ffx.coefs[0] * px + ffx.coefs[1] * py + ffx.coefs[4];
        let fty = ffx.coefs[2] * px + ffx.coefs[3] * py + ffx.coefs[5];
        var faccum = vec2f(0.0, 0.0);

        if (ffx.var_weights[0] != 0.0) { variation_linear(ftx, fty, ffx.var_weights[0], &faccum); }
        if (ffx.var_weights[1] != 0.0) { variation_sinusoidal(ftx, fty, ffx.var_weights[1], &faccum); }
        if (ffx.var_weights[2] != 0.0) { variation_spherical(ftx, fty, ffx.var_weights[2], &faccum); }
        if (ffx.var_weights[3] != 0.0) { variation_swirl(ftx, fty, ffx.var_weights[3], &faccum); }
        if (ffx.var_weights[4] != 0.0) { variation_horseshoe(ftx, fty, ffx.var_weights[4], &faccum); }
        if (ffx.var_weights[5] != 0.0) { variation_polar(ftx, fty, ffx.var_weights[5], &faccum); }
        if (ffx.var_weights[6] != 0.0) { variation_handkerchief(ftx, fty, ffx.var_weights[6], &faccum); }
        if (ffx.var_weights[7] != 0.0) { variation_heart(ftx, fty, ffx.var_weights[7], &faccum); }
        if (ffx.var_weights[8] != 0.0) { variation_disc(ftx, fty, ffx.var_weights[8], &faccum); }
        if (ffx.var_weights[9] != 0.0) { variation_spiral(ftx, fty, ffx.var_weights[9], &faccum); }
        if (ffx.var_weights[10] != 0.0) { variation_hyperbolic(ftx, fty, ffx.var_weights[10], &faccum); }
        if (ffx.var_weights[11] != 0.0) { variation_diamond(ftx, fty, ffx.var_weights[11], &faccum); }
        if (ffx.var_weights[12] != 0.0) { variation_ex(ftx, fty, ffx.var_weights[12], &faccum); }
        if (ffx.var_weights[13] != 0.0) { variation_julia_builtin(ftx, fty, ffx.var_weights[13], &seed, &faccum); }
        if (ffx.var_weights[14] != 0.0) { variation_bent(ftx, fty, ffx.var_weights[14], &faccum); }
        if (ffx.var_weights[15] != 0.0) { variation_waves(ftx, fty, ffx.var_weights[15], ffx.coefs[4], ffx.coefs[5], ffx.coefs[1], ffx.coefs[3], &faccum); }
        if (ffx.var_weights[16] != 0.0) { variation_fisheye(ftx, fty, ffx.var_weights[16], &faccum); }
        if (ffx.var_weights[17] != 0.0) { variation_popcorn(ftx, fty, ffx.var_weights[17], ffx.coefs[4], ffx.coefs[5], &faccum); }
        if (ffx.var_weights[18] != 0.0) { variation_julian(ftx, fty, ffx.var_weights[18], ffx.julian_power, ffx.julian_dist, &seed, &faccum); }
        if (ffx.var_weights[19] != 0.0) { variation_bubble(ftx, fty, ffx.var_weights[19], &faccum); }
        if (ffx.var_weights[20] != 0.0) { variation_noise(ftx, fty, ffx.var_weights[20], &seed, &faccum); }
        if (ffx.var_weights[21] != 0.0) { variation_blur(ftx, fty, ffx.var_weights[21], &seed, &faccum); }
        if (ffx.var_weights[22] != 0.0) {
          let blur_r = pcg_random_f32(&seed);
          let blur_a = pcg_random_f32(&seed) * 2.0 * 3.14159265;
          faccum.x += ffx.var_weights[22] * blur_r * cos(blur_a);
          faccum.y += ffx.var_weights[22] * blur_r * sin(blur_a);
        }
        if (ffx.var_weights[23] != 0.0) { variation_exponential(ftx, fty, ffx.var_weights[23], &faccum); }
        if (ffx.var_weights[24] != 0.0) { variation_power(ftx, fty, ffx.var_weights[24], &faccum); }
        if (ffx.var_weights[25] != 0.0) { variation_cosine(ftx, fty, ffx.var_weights[25], &faccum); }
        if (ffx.var_weights[26] != 0.0) { variation_rings(ftx, fty, ffx.var_weights[26], ffx.rings_coeff, &faccum); }
        if (ffx.var_weights[27] != 0.0) { variation_fan(ftx, fty, ffx.var_weights[27], ffx.fan_dist, &faccum); }
        if (ffx.var_weights[28] != 0.0) { variation_blob(ftx, fty, ffx.var_weights[28], ffx.blob_low, ffx.blob_high, ffx.blob_waves, &faccum); }
        if (ffx.var_weights[29] != 0.0) { variation_pdj(ftx, fty, ffx.var_weights[29], ffx.pdj1, ffx.pdj2, ffx.pdj3, ffx.pdj4, &faccum); }
        if (ffx.var_weights[30] != 0.0) { variation_perspective(ftx, fty, ffx.var_weights[30], ffx.perspective_angle, ffx.perspective_dist, &faccum); }
        if (ffx.var_weights[31] != 0.0) { variation_ngon(ftx, fty, ffx.var_weights[31], ffx.ngon_power, ffx.ngon_sides, ffx.ngon_corners, ffx.ngon_circle, &faccum); }
        if (ffx.var_weights[32] != 0.0) { variation_curl(ftx, fty, ffx.var_weights[32], ffx.curl_c1, ffx.curl_c2, &faccum); }
        if (ffx.var_weights[33] != 0.0) { variation_bipolar(ftx, fty, ffx.var_weights[33], ffx.bipolar_shift, &faccum); }
        if (ffx.var_weights[34] != 0.0) { variation_elliptic(ftx, fty, ffx.var_weights[34], &faccum); }
        if (ffx.var_weights[35] != 0.0) { variation_cell(ftx, fty, ffx.var_weights[35], ffx.cell_size, &faccum); }
        if (ffx.var_weights[36] != 0.0) { variation_crackle(ftx, fty, ffx.var_weights[36], ffx.crackle_scale, ffx.crackle_z, ffx.crackle_spreadx, ffx.crackle_spready, &seed, &faccum); }
        if (ffx.var_weights[37] != 0.0) { variation_juliascope(ftx, fty, ffx.var_weights[37], ffx.juliascope_power, ffx.juliascope_dist, &seed, &faccum); }
        if (ffx.var_weights[38] != 0.0) { variation_split(ftx, fty, ffx.var_weights[38], ffx.split_xsize, ffx.split_ysize, &faccum); }
        if (ffx.var_weights[39] != 0.0) { variation_wedge(ftx, fty, ffx.var_weights[39], ffx.wedge_angle, ffx.wedge_hole, ffx.wedge_count, ffx.wedge_swirl, &faccum); }
        if (ffx.var_weights[40] != 0.0) { variation_wedge_julia(ftx, fty, ffx.var_weights[40], ffx.wedge_julia_power, ffx.wedge_julia_angle, ffx.wedge_julia_count, ffx.wedge_julia_dist, &seed, &faccum); }
        if (ffx.var_weights[41] != 0.0) { variation_wedge_sph(ftx, fty, ffx.var_weights[41], ffx.wedge_sph_angle, ffx.wedge_sph_hole, ffx.wedge_sph_count, ffx.wedge_sph_swirl, &faccum); }
        if (ffx.var_weights[42] != 0.0) { variation_bwraps(ftx, fty, ffx.var_weights[42], ffx.bwraps_cellsize, ffx.bwraps_space, ffx.bwraps_gain, ffx.bwraps_innerTwist, ffx.bwraps_outerTwist, &faccum); }
        if (ffx.var_weights[43] != 0.0) { variation_bwraps7(ftx, fty, ffx.var_weights[43], ffx.bwraps7_cellsize, ffx.bwraps7_space, ffx.bwraps7_gain, ffx.bwraps7_innerTwist, ffx.bwraps7_outerTwist, &faccum); }
        if (ffx.var_weights[44] != 0.0) { variation_motion_blur(ftx, fty, ffx.var_weights[44], ffx.motion_blur_angle, ffx.motion_blur_length, &seed, &faccum); }
        if (ffx.var_weights[45] != 0.0) { variation_zblur(ftx, fty, ffx.var_weights[45], &seed, &faccum); }
        if (ffx.var_weights[46] != 0.0) { variation_gaussian_blur(ftx, fty, ffx.var_weights[46], &seed, &faccum); }
        if (ffx.var_weights[47] != 0.0) { variation_radial_blur(ftx, fty, ffx.var_weights[47], ffx.radial_blur_angle, &seed, &faccum); }

        px = faccum.x;
        py = faccum.y;

        // Post-rotate for final xform
        if (ffx.var_weights[48] != 0.0) {
          let angle = ffx.var_weights[48];
          let cos_a = cos(angle);
          let sin_a = sin(angle);
          let new_y = py * cos_a - sin_a;
          let new_z = py * sin_a + cos_a;
          py = new_y / (new_z + 1.0);
        }
        if (ffx.var_weights[49] != 0.0) {
          let angle = ffx.var_weights[49];
          let cos_a = cos(angle);
          let sin_a = sin(angle);
          let new_x = px * cos_a + sin_a;
          let new_z = -px * sin_a + cos_a;
          px = new_x / (new_z + 1.0);
        }

        // Post-affine of final xform
        let fpost_npx = ffx.post[0] * px + ffx.post[1] * py + ffx.post[4];
        let fpost_npy = ffx.post[2] * px + ffx.post[3] * py + ffx.post[5];
        px = fpost_npx;
        py = fpost_npy;
      }

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

        let rv = u32(cmap.r * wl);
        let gv = u32(cmap.g * wl);
        let bv = u32(cmap.b * wl);

        let base = (u32(iy) * params.width + u32(ix)) * 2u;
        atomicAddSaturate16(&histogram[base], 16u, rv, gv);
        atomicAddSaturate16(&histogram[base + 1u], 16u, bv, 1u);
      }
    }
  }
}
`
