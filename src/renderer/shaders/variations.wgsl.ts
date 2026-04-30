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
`
