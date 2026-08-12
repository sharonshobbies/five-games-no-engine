// A tilted, near-isometric chase camera: fixed yaw, fixed steep pitch, narrow
// FOV so the world reads almost orthographic. It leads the hero slightly and
// can be pulled back to survey the map.
import * as THREE from '../vendor/three.module.min.js';

export class GameCamera {
  constructor() {
    this.cam = new THREE.PerspectiveCamera(30, 1, 1, 900);
    this.target = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.yaw = -Math.PI / 4 + 0.12;
    this.pitch = 0.96;      // radians above the horizon
    this.dist = 112;
    this.distWant = 112;
    this.minDist = 56;
    this.maxDist = 190;
    this.free = false;
    this.freePos = new THREE.Vector3();
  }

  setTarget(x, z, snap) {
    this.target.set(x, 0, z);
    if (snap) { this.look.copy(this.target); this.dist = this.distWant; }
  }

  zoom(delta) {
    this.distWant = Math.min(this.maxDist, Math.max(this.minDist, this.distWant + delta));
  }

  update(dt, level) {
    const k = 1 - Math.pow(0.0016, dt);
    this.look.lerp(this.target, k);
    this.dist += (this.distWant - this.dist) * (1 - Math.pow(0.02, dt));
    const h = Math.sin(this.pitch) * this.dist;
    const r = Math.cos(this.pitch) * this.dist;
    const y = level ? level.sampleHeight(this.look.x, this.look.z) : 0;
    this.cam.position.set(
      this.look.x + Math.cos(this.yaw) * r,
      y + h,
      this.look.z + Math.sin(this.yaw) * r,
    );
    this.cam.lookAt(this.look.x, y + 2.2, this.look.z);
  }

  resize(w, h) {
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  /** Screen → ground plane at a given height, for plot picking. */
  groundPoint(ndcX, ndcY, groundY, out) {
    const ray = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(this.cam);
    ray.sub(this.cam.position).normalize();
    if (Math.abs(ray.y) < 1e-5) return false;
    const t = (groundY - this.cam.position.y) / ray.y;
    if (t < 0) return false;
    out.copy(this.cam.position).addScaledVector(ray, t);
    return true;
  }
}
