import * as THREE from "three";

export const REFUGE_GROUND_Y = 0.28;

export function placeObjectOnRefugeGround(object: THREE.Object3D): number {
  object.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty() || !Number.isFinite(bounds.min.y)) return object.position.y;
  object.position.y += REFUGE_GROUND_Y - bounds.min.y;
  object.updateWorldMatrix(true, true);
  return object.position.y;
}
