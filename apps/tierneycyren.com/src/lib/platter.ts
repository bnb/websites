// The record in each mix is a jog wheel: dragging it round scrubs through the
// mix. Pure, so the mapping is unit-tested without pointer events.

/** How far one full turn of the record scrubs: a turn is a minute of the mix. */
export const SECONDS_PER_TURN = 60;

/** The angle of a point around a centre, in degrees, clockwise from three o'clock. */
export function angleAround(x: number, y: number, cx: number, cy: number): number {
	return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

/** The shortest turn from one angle to another, in degrees: positive is clockwise. */
export function turnBetween(from: number, to: number): number {
	const turn = ((((to - from) % 360) + 540) % 360) - 180;
	return turn === -180 ? 180 : turn;
}

/** Where turning the record `degrees` from `time` lands, kept inside the mix (`duration` 0 is unknown). */
export function scrub(time: number, degrees: number, duration: number): number {
	const to = Math.max(0, time + (degrees / 360) * SECONDS_PER_TURN);
	return duration > 0 ? Math.min(to, duration) : to;
}
