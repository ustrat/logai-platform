
import React from "react";

export const palette = {
  green: "#13c45b",
  blue: "#247cff",
  purple: "#8b5cf6",
  cyan: "#16d3e8",
  orange: "#ff7a18",
  lime: "#6ee751",
  royal: "#2e7cff",
  black: "#0b1020"
};

function Svg({children, color="#247cff", className=""}) {
  return (
    <svg className={className} width="34" height="34" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="54" height="54" rx="17" fill={color} opacity="0.12"/>
      <rect x="9" y="9" width="46" height="46" rx="14" fill={color}/>
      {children}
    </svg>
  );
}

export const ProductIcon = ({name, color}) => {
  const c = palette[color] || color || "#247cff";
  switch(name){
    case "shieldCycle":
      return <Svg color={c}><path d="M32 17l14 6v10c0 10-6 17-14 20-8-3-14-10-14-20V23l14-6z" stroke="white" strokeWidth="4" fill="none"/><path d="M25 33l5 5 10-12" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></Svg>;
    case "refundArrow":
      return <Svg color={c}><path d="M42 24H27c-5 0-9 4-9 9s4 9 9 9h14" stroke="white" strokeWidth="5" strokeLinecap="round"/><path d="M32 16l-8 8 8 8" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/><path d="M36 35c0-3-2-5-5-5s-5 2-5 5 2 5 5 5 5 2 5 5-2 5-5 5-5-2-5-5" stroke="white" strokeWidth="3" strokeLinecap="round"/></Svg>;
    case "timelineCheck":
      return <Svg color={c}><path d="M20 20h24M20 32h18M20 44h10" stroke="white" strokeWidth="5" strokeLinecap="round"/><path d="M42 41l5 5 9-12" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></Svg>;
    case "globePin":
      return <Svg color={c}><circle cx="32" cy="29" r="14" stroke="white" strokeWidth="4"/><path d="M32 15c5 5 5 23 0 28M32 15c-5 5-5 23 0 28M18 29h28" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M32 53s10-9 10-17a10 10 0 10-20 0c0 8 10 17 10 17z" fill="white" opacity=".98"/><circle cx="32" cy="36" r="3" fill={c}/></Svg>;
    case "routeWheel":
      return <Svg color={c}><path d="M18 44c10-22 18 0 28-24" stroke="white" strokeWidth="5" strokeLinecap="round"/><circle cx="18" cy="44" r="5" fill="white"/><circle cx="46" cy="20" r="5" fill="white"/><circle cx="32" cy="32" r="10" stroke="white" strokeWidth="4"/><path d="M32 22v20M22 32h20" stroke="white" strokeWidth="3"/></Svg>;
    case "gaugeNeedle":
      return <Svg color={c}><path d="M18 42a16 16 0 1132 0" stroke="white" strokeWidth="5" strokeLinecap="round"/><path d="M32 40l12-13" stroke="white" strokeWidth="5" strokeLinecap="round"/><circle cx="32" cy="42" r="4" fill="white"/></Svg>;
    case "controlTower":
      return <Svg color={c}><path d="M23 48h18l-4-25H27l-4 25z" stroke="white" strokeWidth="4" fill="none"/><path d="M24 18h16l5 7H19l5-7zM28 31h8M27 39h10" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></Svg>;
    case "commandGrid":
      return <Svg color={c}><path d="M20 20h10v10H20zM34 20h10v10H34zM20 34h10v10H20zM34 34h10v10H34z" fill="white"/><path d="M15 32h34M32 15v34" stroke="white" strokeWidth="2" opacity=".45"/></Svg>;
    case "bellClock":
      return <Svg color={c}><path d="M23 42h18l-3-5V28a6 6 0 00-12 0v9l-3 5z" stroke="white" strokeWidth="4" fill="none"/><path d="M29 47a4 4 0 006 0" stroke="white" strokeWidth="4" strokeLinecap="round"/><circle cx="43" cy="21" r="8" fill="white"/><path d="M43 17v5l4 2" stroke={c} strokeWidth="2.5" strokeLinecap="round"/></Svg>;
    case "draftDoc":
      return <Svg color={c}><path d="M22 17h16l7 7v23H22V17z" stroke="white" strokeWidth="4" fill="none"/><path d="M38 17v8h7M27 31h12M27 38h9" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M39 45l8-8 4 4-8 8-5 1 1-5z" fill="white"/></Svg>;
    case "barLens":
      return <Svg color={c}><path d="M21 43V31M31 43V23M41 43V28" stroke="white" strokeWidth="5" strokeLinecap="round"/><circle cx="39" cy="25" r="11" stroke="white" strokeWidth="4"/><path d="M47 33l7 7" stroke="white" strokeWidth="4" strokeLinecap="round"/></Svg>;
    case "contractDoc":
      return <Svg color={c}><path d="M21 17h22v30H21z" stroke="white" strokeWidth="4" fill="none"/><path d="M27 25h10M27 32h10M27 39h7" stroke="white" strokeWidth="3" strokeLinecap="round"/><circle cx="42" cy="40" r="7" fill="white"/><path d="M42 36v5l3 2" stroke={c} strokeWidth="2.5" strokeLinecap="round"/></Svg>;
    case "currencyGlobe":
      return <Svg color={c}><circle cx="32" cy="32" r="14" stroke="white" strokeWidth="4"/><path d="M18 32h28M32 18c5 5 5 23 0 28M32 18c-5 5-5 23 0 28" stroke="white" strokeWidth="2.5"/><path d="M39 25c-2-2-9-2-9 3 0 6 10 2 10 8 0 5-8 5-11 2M34 22v20" stroke="white" strokeWidth="3" strokeLinecap="round"/></Svg>;
    case "taxCalc":
      return <Svg color={c}><rect x="21" y="17" width="22" height="30" rx="3" stroke="white" strokeWidth="4"/><path d="M26 24h12M27 32h2M35 32h2M27 39h2M35 39h2" stroke="white" strokeWidth="4" strokeLinecap="round"/></Svg>;
    case "escalateArrow":
      return <Svg color={c}><path d="M20 44l24-24M31 20h13v13" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/><path d="M20 30h8M20 38h14" stroke="white" strokeWidth="3" strokeLinecap="round" opacity=".75"/></Svg>;
    default:
      return <Svg color={c}><path d="M20 32h24M32 20v24" stroke="white" strokeWidth="5" strokeLinecap="round"/></Svg>
  }
}
