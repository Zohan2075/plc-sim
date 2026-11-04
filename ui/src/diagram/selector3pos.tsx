import type { ReactNode } from "react";
import {
  SELECTOR_3POS_JOINT_FILLERS,
  SELECTOR_3POS_RING_CENTERS,
  SELECTOR_3POS_STATES,
  SELECTOR_3POS_WRAPPERS
} from "./selector3posArt.generated";
import type { Selector3PosState } from "./selector3posArt.generated";
import { SELECTOR_3POS_ART_WIDTH, SELECTOR_3POS_ZONES } from "./selector3posZones";

export type Selector3PosPosition = Selector3PosState;
export { SELECTOR_3POS_RING_CENTERS };

const SELECTOR_DEBUG_ENABLED = typeof window !== "undefined"
  && (
    new URLSearchParams(window.location.search).get("debugTerminals") === "1"
    || new URLSearchParams(window.location.search).get("debugHitboxes") === "1"
  );
const RING_IDS = ["in1", "out1", "in2", "out2"] as const;

export function renderSelector3Pos(
  position: Selector3PosPosition = 2,
  className = "diagram-symbol",
  debugZones = SELECTOR_DEBUG_ENABLED
): ReactNode {
  const activePosition = position === 1 || position === 3 ? position : 2;
  const elements = SELECTOR_3POS_STATES[activePosition];
  const jointFiller = SELECTOR_3POS_JOINT_FILLERS[activePosition];

  return (
    <svg
      viewBox="0 0 160 102"
      className={`${className} selector3pos-art`}
      style={{ height: "102px", overflow: "visible" }}
      aria-hidden="true"
    >
      <g
        transform={SELECTOR_3POS_WRAPPERS[activePosition]}
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="miter"
        strokeWidth={3.5}
        paintOrder="stroke fill"
      >
        {elements.map((element, index) =>
          element.tag === "path" ? (
            <path
              key={index}
              d={element.d}
              {...(element.fillRule ? { fillRule: element.fillRule } : {})}
            />
          ) : (
            <polygon
              key={index}
              points={element.points}
              {...(element.fillRule ? { fillRule: element.fillRule } : {})}
            />
          )
        )}
        {jointFiller ? (
          <rect
            x={jointFiller.x}
            y={jointFiller.y}
            width={jointFiller.width}
            height={jointFiller.height}
          />
        ) : null}
      </g>
      {debugZones ? (
        <g pointerEvents="none" aria-hidden="true">
          {SELECTOR_3POS_ZONES.map((zone) => (
            <g key={`zone-${zone.position}`}>
              <rect
                x={0}
                y={zone.top}
                width={SELECTOR_3POS_ART_WIDTH}
                height={zone.height}
                fill="rgba(37, 99, 235, 0.05)"
                stroke="#2563eb"
                strokeDasharray="3 3"
                strokeWidth={0.8}
              />
              <text
                x={SELECTOR_3POS_ART_WIDTH / 2}
                y={zone.top + zone.height / 2}
                fill="#1d4ed8"
                fontSize={9}
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {zone.position}
              </text>
            </g>
          ))}
          {RING_IDS.map((ringId) => {
            const center = SELECTOR_3POS_RING_CENTERS[ringId];

            return (
              <g key={ringId}>
                <line
                  x1={center.x - 7}
                  x2={center.x + 7}
                  y1={center.y}
                  y2={center.y}
                  stroke="#f59e0b"
                  strokeWidth={1}
                />
                <line
                  x1={center.x}
                  x2={center.x}
                  y1={center.y - 7}
                  y2={center.y + 7}
                  stroke="#f59e0b"
                  strokeWidth={1}
                />
              </g>
            );
          })}
        </g>
      ) : null}
    </svg>
  );
}
