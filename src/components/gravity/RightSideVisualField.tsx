export function RightSideVisualField() {
  return (
    <div className="right-side-visual" aria-hidden="true">
      <svg className="right-side-visual-canvas" viewBox="0 0 560 640" focusable="false">
        <defs>
          <radialGradient id="visual-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.18" />
            <stop offset="58%" stopColor="var(--color-gold)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="visual-gold-line" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.62" />
            <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        <g className="right-side-visual-grid">
          {Array.from({ length: 7 }).map((_, index) => (
            <line
              key={`vertical-${index}`}
              x1={80 + index * 66}
              y1="60"
              x2={80 + index * 66}
              y2="580"
            />
          ))}
          {Array.from({ length: 9 }).map((_, index) => (
            <line
              key={`horizontal-${index}`}
              x1="40"
              y1={74 + index * 60}
              x2="520"
              y2={74 + index * 60}
            />
          ))}
        </g>

        <g className="right-side-visual-maze">
          <path d="M74 106H210V172H146V236H308V112H470V276H386V340H486V504H356V438H214V548H84V390H172V326H74Z" />
          <path d="M118 142H178V204H334V148H438V242H368V304H450V458H322V402H248V512H126V426H208V362H112V280H270V206H118Z" />
          <path d="M162 170H238V232H366V196H410V264H342V332H414V412H304V374H260V458H182V404H238V348H152V306H296V266H162Z" />
        </g>

        <g className="right-side-visual-squares">
          <rect x="72" y="110" width="64" height="64" />
          <rect x="136" y="174" width="96" height="96" />
          <rect x="232" y="270" width="128" height="128" />
          <rect x="360" y="398" width="96" height="96" />
          <rect x="456" y="494" width="48" height="48" />
        </g>

        <path
          className="right-side-visual-spiral"
          d="M278 322 C278 272 335 251 376 281 C427 319 407 397 345 429 C258 473 171 429 170 341 C169 238 273 163 384 199 C498 236 525 384 442 491"
          fill="none"
        />
        <path className="right-side-visual-axis" d="M58 322H502M280 74V570" />
        <circle
          className="right-side-visual-halo"
          cx="280"
          cy="322"
          r="112"
          fill="url(#visual-core)"
        />
        <circle className="right-side-visual-core" cx="280" cy="322" r="4" />
        <circle className="right-side-visual-ring" cx="280" cy="322" r="18" />

        <g className="right-side-visual-flow">
          <path className="right-side-flow-line" d="M92 566H458" />
          <path
            className="right-side-flow-arrow"
            d="M178 561L188 566L178 571M298 561L308 566L298 571M418 561L428 566L418 571"
          />
          <g className="right-side-flow-node right-side-flow-data" transform="translate(92 566)">
            <circle r="18" />
            <circle cx="-6" cy="-5" r="2" />
            <circle cx="5" cy="-7" r="2" />
            <circle cx="-2" cy="5" r="2" />
            <circle cx="9" cy="5" r="2" />
          </g>
          <g
            className="right-side-flow-node right-side-flow-information"
            transform="translate(212 566)"
          >
            <rect x="-18" y="-13" width="36" height="26" rx="2" />
            <path d="M-11-6H11M-11 0H7M-11 6H11" />
          </g>
          <g
            className="right-side-flow-node right-side-flow-knowledge"
            transform="translate(332 566)"
          >
            <path d="M0-18L16-9V9L0 18L-16 9V-9Z" />
            <circle cx="0" cy="0" r="4" />
            <path d="M0-13V-4M11-6L4-2M11 6L4 2M0 13V4M-11 6L-4 2M-11-6L-4-2" />
          </g>
          <g
            className="right-side-flow-node right-side-flow-decision"
            transform="translate(452 566)"
          >
            <path d="M0-18L18 0L0 18L-18 0Z" />
            <path d="M-8 0H8M0-8V8" />
            <circle r="3" />
          </g>
          <g className="right-side-flow-labels">
            <text x="92" y="598">
              DATA
            </text>
            <text x="212" y="598">
              INFORMATION
            </text>
            <text x="332" y="598">
              KNOWLEDGE
            </text>
            <text x="452" y="598">
              DECISION
            </text>
          </g>
        </g>
      </svg>
      <div className="right-side-visual-footer">
        <span>ABSTRACT ARCHIVE / NOT A HISTORICAL SCRIPT</span>
        <span>GOLDEN RATIO / 1.618</span>
      </div>
    </div>
  );
}
