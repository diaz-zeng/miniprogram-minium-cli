export function readTouches(event) {
  const touches = Array.isArray(event?.touches) ? event.touches : [];
  return touches.map((item) => ({
    x: Number(item?.clientX ?? item?.pageX ?? item?.x ?? 0),
    y: Number(item?.clientY ?? item?.pageY ?? item?.y ?? 0),
  }));
}

export function calcDistance(points) {
  if (points.length < 2) {
    return 0;
  }
  const [first, second] = points;
  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

export function calcCenter(points) {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  if (points.length === 1) {
    return points[0];
  }
  const [first, second] = points;
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

export function formatDecimal(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "1.00";
  }
  return value.toFixed(2);
}

export function formatOffset(x, y) {
  return `${Math.round(x)},${Math.round(y)}`;
}
