export const VARIATIONS_WGSL = /* wgsl */`

fn variation_linear(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  (*accum).x += w * tx;
  (*accum).y += w * ty;
}

fn variation_sinusoidal(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  (*accum).x += w * sin(tx);
  (*accum).y += w * sin(ty);
}

fn variation_spherical(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let r2 = tx * tx + ty * ty + 1e-10;
  (*accum).x += w * tx / r2;
  (*accum).y += w * ty / r2;
}

fn variation_swirl(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let r2 = tx * tx + ty * ty;
  let c1 = sin(r2);
  let c2 = cos(r2);
  (*accum).x += w * (c1 * tx - c2 * ty);
  (*accum).y += w * (c2 * tx + c1 * ty);
}

fn variation_horseshoe(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  var a = atan2(ty, tx);
  let c1 = sin(a);
  let c2 = cos(a);
  (*accum).x += w * (c1 * tx - c2 * ty);
  (*accum).y += w * (c2 * tx + c1 * ty);
}

fn variation_polar(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx) / 3.14159265;
  let r = sqrt(tx * tx + ty * ty);
  (*accum).x += w * a;
  (*accum).y += w * (r - 1.0);
}

fn variation_handkerchief(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty);
  (*accum).x += w * sin(a + r) * r;
  (*accum).y += w * cos(a - r) * r;
}

fn variation_heart(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty);
  let ar = a * r;
  (*accum).x += w * sin(ar) * r;
  (*accum).y += -w * cos(ar) * r;
}

fn variation_disc(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let nx = tx * 3.14159265;
  let ny = ty * 3.14159265;
  let r = sqrt(nx * nx + ny * ny);
  (*accum).x += w * sin(r) * a / 3.14159265;
  (*accum).y += w * cos(r) * a / 3.14159265;
}

fn variation_spiral(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty) + 1e-6;
  (*accum).x += w * (cos(a) + sin(r)) / r;
  (*accum).y += w * (sin(a) - cos(r)) / r;
}

fn variation_hyperbolic(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty) + 1e-6;
  (*accum).x += w * sin(a) / r;
  (*accum).y += w * cos(a) * r;
}

fn variation_diamond(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty);
  (*accum).x += w * sin(a) * cos(r);
  (*accum).y += w * cos(a) * sin(r);
}

fn variation_ex(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty);
  let n0 = sin(a + r);
  let n1 = cos(a - r);
  let m0 = n0 * n0 * n0 * r;
  let m1 = n1 * n1 * n1 * r;
  (*accum).x += w * (m0 + m1);
  (*accum).y += w * (m0 - m1);
}

fn variation_julia_builtin(tx: f32, ty: f32, w: f32, seed: ptr<function, u32>, accum: ptr<function, vec2f>) {
  var a = atan2(ty, tx) / 2.0;
  if (pcg_random(seed) > 0x7fffffffu) {
    a += 3.14159265;
  }
  let r = pow(tx * tx + ty * ty, 0.25);
  (*accum).x += w * r * cos(a);
  (*accum).y += w * r * sin(a);
}

fn variation_bent(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  var c1 = tx;
  var c2 = ty;
  if (c1 < 0.0) { c1 = 2.0 * c1; }
  if (c2 < 0.0) { c2 = c2 / 2.0; }
  (*accum).x += w * c1;
  (*accum).y += w * c2;
}

fn variation_waves(tx: f32, ty: f32, w: f32, e: f32, f: f32, b: f32, d: f32, accum: ptr<function, vec2f>) {
  let nx = tx + b * sin(ty / (e * e + 1e-10));
  let ny = ty + d * sin(tx / (f * f + 1e-10));
  (*accum).x += w * nx;
  (*accum).y += w * ny;
}

fn variation_fisheye(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let r = sqrt(tx * tx + ty * ty);
  let a = atan2(ty, tx);
  let r2 = 2.0 * r / (r + 1.0);
  (*accum).x += w * r2 * cos(a);
  (*accum).y += w * r2 * sin(a);
}

fn variation_popcorn(tx: f32, ty: f32, w: f32, e: f32, f: f32, accum: ptr<function, vec2f>) {
  let dx = tan(3.0 * ty);
  let dy = tan(3.0 * tx);
  (*accum).x += w * (tx + e * sin(dx));
  (*accum).y += w * (ty + f * sin(dy));
}

fn variation_julian(tx: f32, ty: f32, w: f32, power: f32, dist: f32, seed: ptr<function, u32>, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty);
  let p = floor(power);
  let rn = pcg_random_f32(seed);
  let t = (a + 2.0 * 3.14159265 * rn) / p;
  let nr = dist * pow(r, 1.0 / p);
  (*accum).x += w * nr * cos(t);
  (*accum).y += w * nr * sin(t);
}

fn variation_bubble(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let r2 = tx * tx + ty * ty;
  let denom = r2 / 4.0 + 1.0;
  (*accum).x += w * (4.0 * tx / denom);
  (*accum).y += w * (4.0 * ty / denom);
}

fn variation_noise(tx: f32, ty: f32, w: f32, seed: ptr<function, u32>, accum: ptr<function, vec2f>) {
  let r1 = pcg_random_f32(seed);
  let r2 = pcg_random_f32(seed);
  (*accum).x += w * r1 * cos(2.0 * 3.14159265 * r2) * tx;
  (*accum).y += w * r1 * sin(2.0 * 3.14159265 * r2) * ty;
}

fn variation_blur(tx: f32, ty: f32, w: f32, seed: ptr<function, u32>, accum: ptr<function, vec2f>) {
  let r1 = pcg_random_f32(seed);
  let r2 = pcg_random_f32(seed);
  (*accum).x += w * r1 * cos(2.0 * 3.14159265 * r2);
  (*accum).y += w * r1 * sin(2.0 * 3.14159265 * r2);
}

fn variation_exponential(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let e = exp(tx - 1.0);
  let pty_pi = 3.14159265 * ty;
  (*accum).x += w * e * cos(pty_pi);
  (*accum).y += w * e * sin(pty_pi);
}

fn variation_power(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty);
  let rp = pow(r, sin(a));
  (*accum).x += w * rp * cos(a);
  (*accum).y += w * rp * sin(a);
}

fn variation_cosine(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let pi_tx = 3.14159265 * tx;
  (*accum).x += w * cos(pi_tx) * cosh(ty);
  (*accum).y += w * -sin(pi_tx) * sinh(ty);
}

fn variation_rings(tx: f32, ty: f32, w: f32, coeff: f32, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty);
  let p2 = coeff * coeff;
  let shift = r - 2.0 * p2 * floor((r + p2) / (2.0 * p2)) + r * (1.0 - p2);
  let r2 = shift + 1e-10;
  (*accum).x += w * shift * cos(a) / r2;
  (*accum).y += w * shift * sin(a) / r2;
}

fn variation_fan(tx: f32, ty: f32, w: f32, fan_dist: f32, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty);
  let t = 3.14159265 * fan_dist * fan_dist;
  var angle = a;
  if ((angle + t) % (2.0 * t) > t) {
    angle = angle - t;
  } else {
    angle = angle + t;
  }
  (*accum).x += w * r * cos(angle);
  (*accum).y += w * r * sin(angle);
}

fn variation_blob(tx: f32, ty: f32, w: f32, blob_low: f32, blob_high: f32, blob_waves: f32, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty);
  let factor = blob_low + (blob_high - blob_low) * (0.5 + 0.5 * sin(blob_waves * a));
  (*accum).x += w * r * cos(a) * factor;
  (*accum).y += w * r * sin(a) * factor;
}

fn variation_pdj(tx: f32, ty: f32, w: f32, pdj1: f32, pdj2: f32, pdj3: f32, pdj4: f32, accum: ptr<function, vec2f>) {
  (*accum).x += w * (sin(pdj1 * ty) - cos(pdj2 * tx));
  (*accum).y += w * (sin(pdj3 * tx) - cos(pdj4 * ty));
}

fn variation_perspective(tx: f32, ty: f32, w: f32, perspective_angle: f32, perspective_dist: f32, accum: ptr<function, vec2f>) {
  let ang_sin = sin(perspective_angle);
  let ang_cos = cos(perspective_angle);
  let denom = perspective_dist - ty * ang_sin;
  let d = perspective_dist / (denom + 1e-10);
  (*accum).x += w * d * tx;
  (*accum).y += w * d * ty * ang_cos;
}

fn variation_ngon(tx: f32, ty: f32, w: f32, ngon_power: f32, ngon_sides: f32, ngon_corners: f32, ngon_circle: f32, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty);
  let pi2 = 6.2831853;
  let t = a - pi2 * floor(a / pi2);
  let pwr = ngon_power;
  let r_pow = pow(r, pwr);
  var theta = t - pi2 / ngon_sides * floor(t * ngon_sides / pi2);
  if (theta > pi2 / (2.0 * ngon_sides)) {
    theta = theta - pi2 / ngon_sides;
  }
  let amp = ngon_corners * (1.0 / cos(theta) - 1.0) + ngon_circle;
  (*accum).x += w * r_pow * (amp * cos(theta) * cos(a) - sin(a) * sin(theta));
  (*accum).y += w * r_pow * (amp * cos(theta) * sin(a) + cos(a) * sin(theta));
}

fn variation_curl(tx: f32, ty: f32, w: f32, c1: f32, c2: f32, accum: ptr<function, vec2f>) {
  let re = 1.0 + c1 * tx + c2 * (tx * tx - ty * ty);
  let im = c1 * ty + c2 * 2.0 * tx * ty;
  let r2 = re * re + im * im + 1e-10;
  (*accum).x += w * (tx * re + ty * im) / r2;
  (*accum).y += w * (ty * re - tx * im) / r2;
}

fn variation_bipolar(tx: f32, ty: f32, w: f32, shift: f32, accum: ptr<function, vec2f>) {
  let pi2 = 6.2831853;
  let x2y2 = tx * tx + ty * ty;
  let denom = x2y2 + 1.0;
  let a1 = log((denom + 2.0 * tx) / (denom - 2.0 * tx + 1e-10));
  let a2 = pi2 + 2.0 * atan2(2.0 * ty, x2y2 - 1.0);
  (*accum).x += w * a1 / pi2;
  (*accum).y += w * (a2 / pi2 + shift);
}

fn variation_elliptic(tx: f32, ty: f32, w: f32, accum: ptr<function, vec2f>) {
  let x2y2 = tx * tx + ty * ty;
  let xp = x2y2 + 2.0 * tx + 1.0;
  let xm = x2y2 - 2.0 * tx + 1.0;
  let sqrt_xp = sqrt(abs(xp));
  let sqrt_xm = sqrt(abs(xm));
  (*accum).x += w * 0.5 * (sqrt_xp + sqrt_xm);
  (*accum).y += w * 0.5 * (sqrt_xp - sqrt_xm);
}

fn variation_cell(tx: f32, ty: f32, w: f32, cell_size: f32, accum: ptr<function, vec2f>) {
  let s = cell_size;
  let inv_s = 1.0 / (s + 1e-10);
  let cx = floor(tx * inv_s);
  let cy = floor(ty * inv_s);
  let fx = tx * inv_s - cx;
  let fy = ty * inv_s - cy;
  (*accum).x += w * (fx + cx) * s;
  (*accum).y += w * (fy + cy) * s;
}

fn crackle_hash(x: f32, y: f32) -> f32 {
  let n = x * 12.9898 + y * 78.233;
  return fract(sin(n) * 43758.5453);
}

fn variation_crackle(tx: f32, ty: f32, w: f32, scale: f32, crackle_z: f32, spreadx: f32, spready: f32, seed: ptr<function, u32>, accum: ptr<function, vec2f>) {
  let s = scale + 1e-10;
  let inv_s = 1.0 / s;
  let px = tx * inv_s;
  let py = ty * inv_s;
  let ix = floor(px);
  let iy = floor(py);
  var min_d = 1e10;
  var near_x = 0.0;
  var near_y = 0.0;
  for (var dy = -1.0; dy <= 1.0; dy += 1.0) {
    for (var dx = -1.0; dx <= 1.0; dx += 1.0) {
      let cx = ix + dx;
      let cy = iy + dy;
      let hx = crackle_hash(cx, cy + crackle_z) * spreadx;
      let hy = crackle_hash(cx + 7.0, cy + crackle_z + 3.0) * spready;
      let ppx = cx + hx - px;
      let ppy = cy + hy - py;
      let dd = ppx * ppx + ppy * ppy;
      if (dd < min_d) {
        min_d = dd;
        near_x = cx + hx;
        near_y = cy + hy;
      }
    }
  }
  (*accum).x += w * near_x * s;
  (*accum).y += w * near_y * s;
}

fn variation_juliascope(tx: f32, ty: f32, w: f32, power: f32, dist: f32, seed: ptr<function, u32>, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty);
  let p = abs(power);
  let rr = pcg_random(seed);
  let rnd = f32(rr) / 4294967295.0;
  var t = a;
  if (rr > 2147483647u) {
    t = (2.0 * 3.14159265 - a + 2.0 * 3.14159265 * rnd) / p;
  } else {
    t = (a + 2.0 * 3.14159265 * rnd) / p;
  }
  let nr = dist * pow(r, 1.0 / p);
  (*accum).x += w * nr * cos(t);
  (*accum).y += w * nr * sin(t);
}

fn variation_split(tx: f32, ty: f32, w: f32, xsize: f32, ysize: f32, accum: ptr<function, vec2f>) {
  var ox = tx;
  var oy = ty;
  if (ty >= 0.0) {
    ox = tx + xsize;
  } else {
    ox = tx - xsize;
  }
  if (tx >= 0.0) {
    oy = ty + ysize;
  } else {
    oy = ty - ysize;
  }
  (*accum).x += w * ox;
  (*accum).y += w * oy;
}

fn variation_wedge(tx: f32, ty: f32, w: f32, wedge_angle: f32, wedge_hole: f32, wedge_count: f32, wedge_swirl: f32, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty);
  let pi2 = 6.2831853;
  let cf = floor(wedge_count);
  let wedge_j = pi2 / cf;
  let wedge_y = a + wedge_swirl * r;
  var t = wedge_y - wedge_j * floor(wedge_y / wedge_j);
  if (t > wedge_j / 2.0) {
    t = t - wedge_j;
  }
  t = t + wedge_angle * r;
  let r_out = pow(r + wedge_hole, 1.0);
  (*accum).x += w * r_out * cos(t);
  (*accum).y += w * r_out * sin(t);
}

fn variation_wedge_julia(tx: f32, ty: f32, w: f32, power: f32, wedge_angle: f32, wedge_count: f32, dist: f32, seed: ptr<function, u32>, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty);
  let pi2 = 6.2831853;
  let p = abs(power);
  let cf = floor(wedge_count);
  let rr = pcg_random(seed);
  let rnd = f32(rr) / 4294967295.0;
  var t = a;
  if (rr > 2147483647u) {
    t = (pi2 - a + pi2 * rnd) / p;
  } else {
    t = (a + pi2 * rnd) / p;
  }
  let wedge_j = pi2 / cf;
  var wt = t - wedge_j * floor(t / wedge_j);
  if (wt > wedge_j / 2.0) {
    wt = wt - wedge_j;
  }
  wt = wt + wedge_angle * r;
  let nr = dist * pow(r, 1.0 / p);
  (*accum).x += w * nr * cos(wt);
  (*accum).y += w * nr * sin(wt);
}

fn variation_wedge_sph(tx: f32, ty: f32, w: f32, wedge_angle: f32, wedge_hole: f32, wedge_count: f32, wedge_swirl: f32, accum: ptr<function, vec2f>) {
  let a = atan2(ty, tx);
  let r = sqrt(tx * tx + ty * ty);
  let pi2 = 6.2831853;
  let cf = floor(wedge_count);
  let wedge_j = pi2 / cf;
  var t = a + wedge_swirl * r;
  t = t - wedge_j * floor(t / wedge_j);
  if (t > wedge_j / 2.0) {
    t = t - wedge_j;
  }
  t = t + wedge_angle * r;
  let r2 = r + wedge_hole;
  let rr = 1.0 / (r2 + 1e-10);
  (*accum).x += w * rr * cos(t);
  (*accum).y += w * rr * sin(t);
}

fn variation_bwraps(tx: f32, ty: f32, w: f32, cellsize: f32, space: f32, gain: f32, inner_twist: f32, outer_twist: f32, accum: ptr<function, vec2f>) {
  let s2 = cellsize * cellsize;
  let t = space * (gain * gain + 1e-10);
  var px = tx;
  var py = ty;
  if (px > s2) { px = px - s2; }
  if (px < -s2) { px = px + s2; }
  if (py > s2) { py = py - s2; }
  if (py < -s2) { py = py + s2; }
  let r = sqrt(px * px + py * py);
  let a = atan2(py, px);
  let vmax = t * gain;
  let vr = r / (vmax + 1e-10);
  var theta = a;
  if (r < t) {
    theta = theta + inner_twist * (1.0 - vr);
  } else {
    theta = theta + outer_twist * (vr - 1.0);
  }
  (*accum).x += w * r * cos(theta);
  (*accum).y += w * r * sin(theta);
}

fn variation_bwraps7(tx: f32, ty: f32, w: f32, cellsize: f32, space: f32, gain: f32, inner_twist: f32, outer_twist: f32, accum: ptr<function, vec2f>) {
  let s2 = cellsize * cellsize;
  let t = space * (gain * gain + 1e-10);
  var px = tx;
  var py = ty;
  if (px > s2) { px = px - s2; }
  if (px < -s2) { px = px + s2; }
  if (py > s2) { py = py - s2; }
  if (py < -s2) { py = py + s2; }
  let r = sqrt(px * px + py * py);
  let a = atan2(py, px);
  let vmax = t * gain;
  let vr = r / (vmax + 1e-10);
  var theta = a;
  if (r < t) {
    theta = theta + inner_twist * (1.0 - vr);
  } else {
    theta = theta + outer_twist * (vr - 1.0);
  }
  (*accum).x += w * r * cos(theta);
  (*accum).y += w * r * sin(theta);
}

fn variation_motion_blur(tx: f32, ty: f32, w: f32, angle: f32, length: f32, seed: ptr<function, u32>, accum: ptr<function, vec2f>) {
  let rnd = pcg_random_f32(seed);
  let t = (rnd - 0.5) * length;
  let cos_a = cos(angle);
  let sin_a = sin(angle);
  (*accum).x += w * (tx + t * cos_a);
  (*accum).y += w * (ty + t * sin_a);
}

fn variation_zblur(tx: f32, ty: f32, w: f32, seed: ptr<function, u32>, accum: ptr<function, vec2f>) {
  let r = pcg_random_f32(seed);
  let a = pcg_random_f32(seed) * 6.2831853;
  (*accum).x += w * (tx + r * cos(a));
  (*accum).y += w * (ty + r * sin(a));
}

fn variation_gaussian_blur(tx: f32, ty: f32, w: f32, seed: ptr<function, u32>, accum: ptr<function, vec2f>) {
  let r1 = pcg_random_f32(seed);
  let r2 = pcg_random_f32(seed);
  let rho = sqrt(-2.0 * log(r1 + 1e-10));
  let theta = 6.2831853 * r2;
  (*accum).x += w * rho * cos(theta);
  (*accum).y += w * rho * sin(theta);
}

fn variation_radial_blur(tx: f32, ty: f32, w: f32, angle: f32, seed: ptr<function, u32>, accum: ptr<function, vec2f>) {
  let r = sqrt(tx * tx + ty * ty);
  let a = atan2(ty, tx);
  let rnd = pcg_random_f32(seed);
  let blur = (rnd - 0.5) * angle;
  (*accum).x += w * r * cos(a + blur);
  (*accum).y += w * r * sin(a + blur);
}
`
