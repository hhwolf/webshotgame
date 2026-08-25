export function movementVelocity(yaw, forward, strafe, speed) {
  const length = Math.hypot(forward, strafe) || 1;
  return {
    x: (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) / length * speed,
    z: (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) / length * speed
  };
}
