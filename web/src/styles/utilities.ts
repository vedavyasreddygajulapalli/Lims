import { twMerge } from "tailwind-merge";
/** Shared Tailwind component recipes. Semantic markers support descendant variants only. */
const recipes: Record<string, string> = {
  eyebrow:
    "text-[length:11px] tracking-[1.7px] font-bold text-[color:#799087] mb-[12px] max-[760px]:text-[length:10px]",
  muted: "text-[color:var(--muted)]",
  "sr-only":
    "absolute w-[1px] h-[1px] p-[0] m-[-1px] overflow-hidden [clip:rect(0,_0,_0,_0)] whitespace-nowrap border-0",
  spin: "[animation:spin_1s_linear_infinite]",
  btn: "[border:1px_solid_transparent] rounded-[7px] [padding:10px_15px] inline-flex gap-[8px] items-center justify-center text-[length:11px] font-semibold leading-[1.4] whitespace-nowrap [transition:background_0.15s]",
  "btn-primary":
    "[background:var(--green)] text-[color:white] [box-shadow:0_2px_3px_#1c554b10] [&:hover]:[background:#1b6357]",
  "btn-secondary":
    "border-[#dfe7e3] [background:white] text-[color:#536c63] [&:hover]:[background:#eff5f1]",
  "btn-ghost":
    "[&:hover]:[background:#eff5f1] [background:transparent] text-[color:#608278] [padding:7px_8px]",
  card: "[border:1px_solid_var(--line)] rounded-[var(--radius)] [background:var(--card)] shadow-[var(--shadow)] overflow-hidden",
  field:
    "flex flex-col gap-[8px] mb-[19px] text-[length:11px] font-semibold [&_>_span]:text-[color:#52695f] [&_input]:w-full [&_input]:[padding:12px_13px] [&_input]:[border:1px_solid_#dde5e1] [&_input]:[background:#fff] [&_input]:rounded-[7px] [&_input]:text-[color:#2d453b] [&_input]:text-[length:12px] [&_input]:min-h-[42px] [&_select]:w-full [&_select]:[padding:12px_13px] [&_select]:[border:1px_solid_#dde5e1] [&_select]:[background:#fff] [&_select]:rounded-[7px] [&_select]:text-[color:#2d453b] [&_select]:text-[length:12px] [&_select]:min-h-[42px] [&_input[readonly]]:[background:#f8faf9] [&_input[readonly]]:text-[color:#667c71] [&_input::placeholder]:text-[color:#a5b1ab] [&_small]:font-normal",
  badge:
    "inline-flex items-center gap-[6px] rounded-[5px] [padding:5px_8px] text-[length:11px] font-semibold whitespace-nowrap [&_>_span]:w-[4px] [&_>_span]:h-[4px] [&_>_span]:[background:currentColor] [&_>_span]:rounded-[50%]",
  "badge-neutral": "[background:#f0f3f2] text-[color:#7c8b84]",
  "badge-green": "[background:#eaf5ed] text-[color:#40805c]",
  "badge-amber": "[background:#fbf3e5] text-[color:#a17d34]",
  "badge-red": "[background:#fcecec] text-[color:#ac5c5c]",
  "badge-blue": "[background:#edf3f8] text-[color:#6487a2]",
  notice:
    "flex gap-[10px] items-start [padding:14px_16px] rounded-[8px] [margin:0_0_20px] text-[length:11px] leading-[1.65] [border:1px_solid] [&_>_svg]:[flex-shrink:0] [&_>_svg]:mt-[1px]",
  "notice-amber": "text-[color:#8c753f] [background:#fffaf0] border-[#f0e8d4]",
  "notice-red": "text-[color:#a54545] [background:#fff3f2] border-[#f4dfdd]",
  "notice-green": "text-[color:#377957] [background:#eff8f1] border-[#deeee0]",
  "page-heading":
    "flex items-center justify-between gap-[20px] mb-[29px] [&_>_div_>_p:last-child]:m-[0] [&_>_div_>_p:last-child]:text-[length:11px] max-[760px]:items-start max-[760px]:gap-[12px] max-[760px]:mb-[22px] max-[760px]:[&_.btn]:text-[length:11px] max-[760px]:[&_.btn]:[padding:9px_10px] max-[760px]:[&_>_div_>_p:last-child]:text-[length:10px]",
  "section-heading":
    "flex justify-between items-center gap-[15px] [padding:23px_24px_18px] [&_p]:text-[length:10px] [&_p]:m-[0] [&_>_svg]:text-[color:#8fa69c] min-[1450px]:[&_h2]:text-[length:17px] min-[1450px]:[&_p]:text-[length:11px] max-[760px]:p-[20px] max-[760px]:[&_h2]:text-[length:14px]",
  empty:
    "flex flex-col items-center justify-center text-center [padding:65px_20px] text-[color:#90a79c] min-h-[160px] [&_h3]:[margin:0_0_7px] [&_h3]:text-[color:#506d5e] [&_p]:text-[length:11px]",
  "empty-icon":
    "w-[54px] h-[54px] grid [place-items:center] [background:#f1f6f3] rounded-[15px] mb-[16px]",
  "table-scroll": "overflow-auto",
  "record-number": "font-semibold text-[color:#3c6757]",
  "record-link":
    "font-semibold text-[color:#3c6757] [background:transparent] border-0 p-[0] text-[length:11px] whitespace-nowrap [&:hover]:underline",
  pagination:
    "[border-top:1px_solid_var(--line)] [padding:15px_22px] flex justify-between items-center text-[color:#91a096] text-[length:10px] [&_>_div]:flex [&_>_div]:items-center [&_>_div]:gap-[13px] [&_.btn]:[padding:6px_8px] max-[760px]:p-[14px] max-[760px]:text-[length:10px] max-[760px]:[&_>_div]:gap-[7px]",
  overlay:
    "fixed [inset:0] [background:#152e295c] [backdrop-filter:blur(4px)] z-[50] flex items-center justify-center p-[24px] max-[760px]:p-[14px]",
  modal:
    "[background:white] [border:1px_solid_#e7eee8] rounded-[14px] max-w-full min-w-0 w-[570px] p-[28px] max-h-[90dvh] overflow-auto [box-shadow:0_30px_90px_#132d2830] outline-none max-[760px]:p-[22px]",
  "modal-wide": "w-[760px]",
  "modal-title":
    "flex justify-between items-center mb-[24px] [&_h2]:text-[length:21px] [&_.eyebrow]:mb-[8px] max-[760px]:[&_h2]:text-[length:18px]",
  "form-intro": "text-[length:11px] mb-[24px]",
  "form-grid":
    "grid [grid-template-columns:1fr_1fr] [gap:0_16px] max-[760px]:[grid-template-columns:1fr]",
  "form-actions":
    "flex justify-end gap-[10px] [border-top:1px_solid_var(--line)] pt-[20px]",
  pill: "text-[length:11px] [padding:7px_10px] [border:1px_solid_#e7eee9] rounded-[6px] text-[color:#819489] whitespace-nowrap",
  "large-icon":
    "grid [place-items:center] w-[47px] h-[47px] rounded-[11px] [background:#ecf4ef] text-[color:#427b65]",
  "app-shell": "flex min-h-[100vh]",
  sidebar:
    "w-[237px] fixed [inset:0_auto_0_0] z-[30] [border-right:1px_solid_var(--line)] [background:white] [padding:26px_17px_15px] flex flex-col [&_nav]:overflow-y-auto [&_nav]:flex-1 min-[1600px]:w-[255px] max-[1050px]:w-[215px] max-[1050px]:pl-[12px] max-[1050px]:pr-[12px] max-[760px]:[transform:translateX(-100%)] max-[760px]:[transition:transform_0.2s] max-[760px]:w-[245px] max-[760px]:[&_.brand]:text-[length:14px]",
  brand:
    "flex items-center gap-[10px] text-[color:#29483a] [font-weight:750] text-[length:16px] tracking-[-0.4px] [padding:0_8px] [&_>_div_>_span]:block [&_>_div_>_span]:text-[color:#6c8169] [&_>_div_>_span]:tracking-[1.15px] [&_>_div_>_span]:text-[length:10px] [&_>_div_>_span]:[font-weight:650] [&_>_div_>_span]:mt-[4px] min-[1600px]:text-[length:18px]",
  "brand-icon":
    "w-[36px] h-[39px] grid [place-items:center] [background:#eff5ef] [border:1px_solid_#e7eee7] rounded-[10px] text-[color:#366b52]",
  "workspace-switch":
    "flex items-center gap-[9px] [border:1px_solid_#e6ede7] rounded-[9px] [padding:11px_9px] [margin:29px_0_7px] text-[length:10px] text-[color:#52705b] font-semibold [background:#fcfdfb] [&_small]:block [&_small]:text-[length:10px] [&_small]:text-[color:#76866b] [&_small]:font-normal [&_>_svg]:ml-auto [&_>_svg]:text-[color:#a3b09b]",
  "workspace-avatar":
    "grid [place-items:center] w-[27px] h-[28px] [border:1px_solid_#dce8d7] [background:#eef5e8] rounded-[6px] text-[length:11px] text-[color:#698253]",
  "nav-group":
    "text-[length:10px] [font-weight:650] tracking-[1.4px] text-[color:#7c8b70] [margin:23px_11px_12px] min-[1600px]:text-[length:10px]",
  "nav-item":
    "flex items-center w-full gap-[11px] [background:transparent] border-0 [padding:11px_12px] text-[color:#819080] rounded-[6px] text-left text-[length:12px] font-medium mb-[4px] [&_>_svg]:text-[color:#98a593] [&_>_svg]:[stroke-width:1.7] [&:hover]:[background:#f6f8f4] [&.nav-active]:[background:#eaf3e7] [&.nav-active]:text-[color:#466c36] [&.nav-active]:font-semibold [&.nav-active_>_svg]:text-[color:#527943] min-[1600px]:text-[length:12px] min-[1600px]:p-[13px]",
  "nav-tag":
    "text-[length:10px] [padding:3px_4px] [background:#f2f5ed] [border:1px_solid_#e6ecdf] rounded-[3px] ml-auto tracking-[0.6px] text-[color:#9aa98f]",
  "sidebar-info":
    "[margin:24px_7px_20px] [padding:14px_12px] [background:#f7f9f4] [border:1px_solid_#eef1e7] rounded-[7px] text-[length:10px] relative [&_b]:text-[length:10px] [&_b]:font-semibold [&_b]:text-[color:#7a8d68] [&_p]:text-[length:10px] [&_p]:[margin:7px_0_0] [&_p]:text-[color:#7a8d6e] [&_p]:leading-[1.6]",
  "online-dot":
    "inline-block w-[5px] h-[5px] [background:#93b27e] rounded-[50%] mr-[6px]",
  profile:
    "flex items-center gap-[9px] [border-top:1px_solid_var(--line)] [padding:16px_4px_0] [&_b]:block [&_b]:text-[length:11px] [&_b]:text-[color:#668069] [&_b]:font-semibold [&_small]:block [&_small]:max-w-[120px] [&_small]:overflow-hidden [&_small]:whitespace-nowrap [&_small]:text-ellipsis [&_small]:text-[length:10px] [&_>_.btn]:ml-auto [&_>_.btn]:p-[5px]",
  "profile-avatar":
    "w-[29px] h-[29px] grid [place-items:center] rounded-[50%] [background:#f3e8dd] text-[color:#aa8868] text-[length:11px]",
  "main-shell":
    "ml-[237px] flex-1 min-w-0 min-[1600px]:ml-[255px] max-[1050px]:ml-[215px] max-[760px]:ml-[0]",
  topbar:
    "h-[69px] [background:#fff] [border-bottom:1px_solid_var(--line)] [padding:0_32px] flex items-center justify-between gap-[10px] [&_>_div]:flex [&_>_div]:items-center max-[1050px]:[padding:0_24px] max-[760px]:[padding:0_15px] max-[760px]:h-[58px] max-[760px]:[&_>_div:first-child]:gap-[10px]",
  breadcrumb:
    "text-[length:11px] text-[color:#71836d] [&_>_span]:[margin:0_12px] [&_>_span]:text-[color:#c9d2c9] [&_>_b]:font-medium [&_>_b]:text-[color:#6d826d] max-[760px]:text-[length:10px]",
  "topbar-right": "gap-[18px]",
  environment:
    "text-[length:10px] text-[color:#8a9a7e] flex items-center gap-[6px] [&_>_span]:w-[5px] [&_>_span]:h-[5px] [&_>_span]:rounded-[50%] [&_>_span]:[background:#73974f] max-[1050px]:hidden",
  "topbar-date":
    "text-[length:11px] text-[color:#738266] [border-left:1px_solid_var(--line)] pl-[18px] max-[1050px]:border-0 max-[1050px]:p-[0] max-[760px]:text-[length:10px]",
  "demo-strip":
    "[background:#f5f7ee] [border-bottom:1px_solid_#e9eddf] [padding:7px_32px] text-[length:10px] text-[color:#718255] flex justify-between items-center max-[760px]:[padding:7px_17px] max-[760px]:text-[length:10px] max-[760px]:[&_>_svg]:hidden",
  "mobile-menu": "hidden max-[760px]:inline-flex",
  "mobile-close":
    "hidden max-[760px]:inline-flex max-[760px]:ml-auto max-[760px]:p-[5px]",
  "sidebar-backdrop":
    "hidden max-[760px]:block max-[760px]:fixed max-[760px]:[inset:0] max-[760px]:[background:#1c35294d] max-[760px]:z-[25] max-[760px]:border-0",
  "skip-link":
    "fixed [left:16px] [top:-100px] z-[100] [background:white] p-[12px] [&:focus]:[top:10px]",
  "sidebar-open": "max-[760px]:[transform:translateX(0)]",
  "metric-grid":
    "grid [grid-template-columns:repeat(4,_1fr)] gap-[17px] mb-[23px] max-[1150px]:gap-[12px] max-[960px]:[grid-template-columns:1fr_1fr] max-[760px]:gap-[12px] max-[760px]:mb-[18px]",
  "metric-card":
    "text-left [background:white] [border:1px_solid_var(--line)] rounded-[10px] p-[20px] shadow-[var(--shadow)] [transition:transform_0.15s] [&:hover]:[transform:translateY(-2px)] [&:hover]:border-[#c9dbcc] [&_>_div]:flex [&_>_div]:justify-between [&_>_div]:items-center [&_>_div]:gap-[8px] [&_>_div_>_span:first-child]:text-[length:10px] [&_>_div_>_span:first-child]:text-[color:#7b9180] [&_strong]:block [&_strong]:text-[length:32px] [&_strong]:font-semibold [&_strong]:text-[color:#314f3d] [&_strong]:[margin:11px_0_12px] [&_strong]:tracking-[-1px] [&_strong]:leading-[1.2] [&_p]:text-[length:10px] [&_p]:flex [&_p]:justify-between [&_p]:items-center [&_p]:m-[0] [&_p]:text-[color:#71826a] [&_p_svg]:text-[color:#a5b895] min-[1450px]:p-[25px] min-[1450px]:[&_>_div_>_span:first-child]:text-[length:12px] min-[1450px]:[&_p]:text-[length:10px] max-[1150px]:p-[15px] max-[1150px]:[&_>_div_>_span:first-child]:text-[length:11px] max-[1150px]:[&_p]:text-[length:10px] max-[960px]:[&_p]:text-[length:11px] max-[960px]:[&_>_div_>_span:first-child]:text-[length:11px] max-[760px]:p-[16px] max-[760px]:[&_strong]:text-[length:30px] max-[760px]:[&_p]:text-[length:10px] max-[760px]:[&_>_div_>_span:first-child]:text-[length:11px]",
  "metric-icon":
    "w-[29px] h-[29px] [border:1px_solid_#edf1e8] [background:#fafcf7] rounded-[7px] grid [place-items:center] text-[color:#8caa77] max-[760px]:w-[26px] max-[760px]:h-[26px]",
  "dashboard-main-grid":
    "grid [grid-template-columns:1.55fr_1fr] gap-[22px] mb-[23px] max-[1150px]:[grid-template-columns:1.3fr_1fr] max-[960px]:[grid-template-columns:1fr] max-[760px]:gap-[18px] max-[760px]:mb-[18px]",
  "chart-legend":
    "[padding:0_24px] flex items-center gap-[7px] text-[color:#718268] text-[length:11px] [&_>_span]:w-[6px] [&_>_span]:h-[6px] [&_>_span]:[background:#80a66c] [&_>_span]:rounded-[50%] [&_>_b]:font-semibold [&_>_b]:text-[color:#657f55]",
  "bar-chart":
    "relative flex items-end justify-around h-[205px] [padding:19px_24px_0] gap-[12px] [margin:0_8px_23px] min-[1450px]:h-[215px]",
  "chart-grid":
    "absolute [inset:22px_20px_30px] flex flex-col justify-between [&_>_span]:[border-bottom:1px_dashed_#e7eee2] [&_>_span]:w-full",
  "bar-column":
    "relative z-[1] flex flex-col justify-end items-center gap-[9px] flex-1 h-full",
  "bar-fill":
    "w-[38px] max-w-[80%] [background:linear-gradient(0deg,_#c7d9bb,_#80a86c)] [border-radius:4px_4px_0_0]",
  "bar-value": "text-[length:10px] text-[color:#72885e]",
  "bar-label": "h-[20px] text-[length:10px] text-[color:#77866d]",
  "material-total":
    "flex [align-items:baseline] gap-[10px] [padding:0_24px] mt-[4px] [&_>_strong]:text-[length:29px] [&_>_strong]:font-semibold [&_>_strong]:tracking-[-1px] [&_>_strong]:text-[color:#3a5942] [&_>_span]:text-[length:10px] [&_>_span]:text-[color:#728269]",
  "stacked-bar":
    "flex h-[9px] rounded-[4px] overflow-hidden gap-[3px] [margin:17px_24px_20px]",
  "material-list":
    "[padding:0_24px_20px] grid [grid-template-columns:1fr_1fr] [gap:13px_20px] [&_>_div]:flex [&_>_div]:items-center [&_>_div]:gap-[7px] [&_>_div]:text-[length:11px] [&_>_div_>_span]:w-[5px] [&_>_div_>_span]:h-[5px] [&_>_div_>_span]:rounded-[50%] [&_b]:font-normal [&_b]:text-[color:#627a53] [&_b]:flex-1 [&_small]:text-[length:10px] [&_small]:text-[color:#7b896d] [&_strong]:text-[length:11px] [&_strong]:font-medium [&_strong]:text-[color:#738a60] min-[1450px]:[&_>_div]:text-[length:11px] max-[1150px]:[grid-template-columns:1fr] max-[1150px]:[&_>_div]:text-[length:10px] max-[960px]:[grid-template-columns:1fr_1fr] max-[960px]:[&_>_div]:text-[length:10px]",
  "dashboard-bottom-grid":
    "grid [grid-template-columns:1.55fr_1fr] gap-[22px] mb-[24px] max-[1150px]:[grid-template-columns:1.3fr_1fr] max-[960px]:[grid-template-columns:1fr] max-[760px]:gap-[18px] max-[760px]:mb-[18px]",
  "requests-card":
    "[&_th]:pl-[23px] [&_th]:pr-[12px] [&_td]:pl-[23px] [&_td]:pr-[12px] [&_td]:text-[length:11px] [&_td]:pt-[13px] [&_td]:pb-[13px] [&_th]:text-[length:10px] [&_.record-number]:text-[length:10px] [&_.btn]:text-[length:11px] min-[1450px]:[&_td]:text-[length:11px]",
  "attention-row":
    "flex items-center text-left gap-[10px] [width:calc(100%_-_48px)] [margin:0_24px] [padding:18px_0] [background:none] border-0 [border-bottom:1px_solid_#edf1e8] [&:last-child]:[border-bottom:0] [&_div]:flex-1 [&_b]:block [&_b]:text-[length:11px] [&_b]:font-medium [&_b]:text-[color:#7e916e] [&_small]:block [&_small]:text-[length:10px] [&_small]:mt-[4px] [&_small]:text-[color:#7e8d6e] [&_strong]:text-[length:14px] [&_strong]:font-medium [&_strong]:text-[color:#7d9566] [&_>_svg]:text-[color:#b9c6a8] min-[1450px]:[&_b]:text-[length:11px] min-[1450px]:[&_small]:text-[length:10px] max-[960px]:[&_b]:text-[length:11px] max-[960px]:[&_small]:text-[length:10px]",
  "attention-icon":
    "w-[32px] h-[32px] rounded-[8px] grid [place-items:center] [&.amber]:[background:#fbf7e9] [&.amber]:text-[color:#c9b576] [&.blue]:[background:#f0f5f7] [&.blue]:text-[color:#9cb9c5] [&.green]:[background:#f0f6e9] [&.green]:text-[color:#a7bb8d]",
  "reference-banner":
    "flex items-center gap-[19px] [padding:23px_24px] [background:linear-gradient(110deg,_#eef4e8,_#f5f7ee)] [border:1px_solid_#e0e9d5] rounded-[11px] [&_>_div]:flex-1 [&_.badge]:p-[0] [&_.badge]:[background:none] [&_.badge]:text-[length:10px] [&_.badge]:text-[color:#9eb185] [&_.badge]:mb-[8px] [&_h3]:text-[length:12px] [&_h3]:[margin:0_0_5px] [&_h3]:text-[color:#6c8652] [&_p]:text-[length:11px] [&_p]:text-[color:#74875d] [&_p]:m-[0] [&_.btn]:text-[length:11px] [&_.btn]:text-[color:#7d9567] [&_.btn]:border-[#dce6d2] max-[1150px]:gap-[13px] max-[1150px]:[&_.btn]:text-[length:10px] max-[960px]:flex-wrap max-[960px]:[&_>_.btn]:ml-[68px] max-[760px]:p-[19px] max-[760px]:gap-[12px] max-[760px]:[&_h3]:text-[length:11px] max-[760px]:[&_.btn]:ml-[49px]",
  "reference-banner-icon":
    "w-[49px] h-[49px] rounded-[11px] grid [place-items:center] [background:#e4edda] [border:1px_solid_#dbe7cd] text-[color:#8ea76d] max-[760px]:w-[37px] max-[760px]:h-[37px]",
  "register-card": "mt-[5px]",
  "register-toolbar":
    "[padding:20px_23px] [border-bottom:1px_solid_var(--line)] flex items-center justify-between gap-[16px] max-[960px]:flex-wrap max-[760px]:p-[17px]",
  "register-count":
    "text-[length:11px] font-semibold text-[color:#5d785f] flex items-center gap-[8px] [&_>_span]:text-[length:10px] [&_>_span]:[background:#eff4ea] [&_>_span]:[padding:3px_6px] [&_>_span]:rounded-[4px] [&_>_span]:text-[color:#91a578] max-[760px]:text-[length:10px]",
  "register-controls":
    "flex items-center gap-[8px] [&_.btn]:text-[length:11px] [&_.btn]:[padding:8px_10px] max-[1150px]:[&_.btn_>_span]:hidden max-[960px]:w-full max-[760px]:gap-[6px] max-[760px]:[&_.btn]:p-[8px]",
  "search-box":
    "flex items-center gap-[7px] [border:1px_solid_#e6ede2] rounded-[7px] [padding:7px_10px] text-[color:#a2b294] max-w-[260px] [&_input]:border-0 [&_input]:outline-none [&_input]:[background:transparent] [&_input]:text-[length:10px] [&_input]:text-[color:#5e7753] [&_input]:w-[155px] [&_input::placeholder]:text-[color:#adbaa3] max-[1150px]:[&_input]:w-[130px] max-[960px]:flex-1 max-[960px]:max-w-[none] max-[960px]:[&_input]:w-full",
  "record-meta":
    "[padding:12px_14px] [background:#f7faf5] rounded-[7px] mb-[20px] text-[length:10px] flex gap-[15px] text-[color:#95a786] [overflow-wrap:anywhere] [&_code]:text-[length:11px] [&_code]:text-[color:#7e976a] max-[760px]:flex-col max-[760px]:gap-[6px]",
  "detail-grid":
    "grid [grid-template-columns:1fr_1fr] [gap:18px_24px] mb-[30px] [&_dt]:text-[length:11px] [&_dt]:text-[color:#71865e] [&_dt]:mb-[6px] [&_dd]:m-[0] [&_dd]:text-[color:#607c50] [&_dd]:text-[length:11px] [&_dd]:[overflow-wrap:anywhere] max-[760px]:[grid-template-columns:1fr]",
  "observation-section":
    "[border-top:1px_solid_var(--line)] pt-[10px] [&_.section-heading]:[padding:14px_0_20px] [&_h3]:mb-[6px] [&_>_.notice]:mt-[20px]",
  "observation-row":
    "flex items-center gap-[12px] [&_.field]:flex-1 [&_.field]:min-w-0 max-[760px]:gap-[8px] max-[760px]:[&_.field_input]:p-[10px] max-[760px]:[&_.field_input]:text-[length:10px]",
  "audit-json":
    "[background:#f7faf5] p-[15px] overflow-auto text-[length:10px] text-[color:#76945d]",
  "reference-layout":
    "grid [grid-template-columns:1.35fr_1fr] gap-[24px] mb-[24px] max-[1150px]:[grid-template-columns:1.2fr_1fr] max-[960px]:[grid-template-columns:1fr]",
  "calculator-card":
    "p-[25px] [&_.section-heading]:p-[0] [&_.section-heading]:justify-start [&_.section-heading]:mb-[25px] [&_.section-heading_h2]:text-[length:17px] [&_>_.notice]:[margin:20px_0_0] max-[760px]:p-[22px]",
  "formula-display":
    "flex items-center justify-center gap-[20px] [background:#f7faf5] [border:1px_solid_#e8efdf] rounded-[10px] p-[23px] mb-[25px] text-[color:#7f9965] [&_>_span]:[font-family:Georgia,_serif] [&_>_span]:italic [&_>_span]:text-[length:24px] [&_>_div]:text-center [&_>_div]:text-[length:11px] [&_hr]:border-0 [&_hr]:[border-top:1px_solid_#ccdcb9] [&_hr]:[margin:8px_0]",
  "calculation-result":
    "mt-[24px] p-[25px] [background:#edf5e7] [border:1px_solid_#dcebcf] rounded-[9px] [&_>_span]:text-[length:10px] [&_>_span]:tracking-[1px] [&_>_span]:text-[color:#6c8d4d] [&_strong]:block [&_strong]:text-[length:39px] [&_strong]:font-semibold [&_strong]:text-[color:#72964e] [&_strong]:[margin:12px_0] [&_strong_small]:text-[length:13px] [&_strong_small]:font-normal [&_strong_small]:ml-[10px] [&_strong_small]:text-[color:#6c8d4d] [&_p]:text-[length:11px] [&_p]:m-[0] [&_p]:text-[color:#6c8d4d] [&_details]:text-[length:10px] [&_details]:mt-[14px] [&_details]:text-[color:#8aa866] [&_code]:block [&_code]:mt-[10px]",
  "source-card":
    "p-[28px] [&_>_h2]:text-[length:20px] [&_>_h2]:mt-[22px] [&_>_h2]:text-[color:#65804e] [&_>_p]:text-[length:11px] [&_>_p]:text-[color:#6e825c] [&_>_small]:block [&_>_small]:text-[length:11px] [&_>_small]:text-[color:#7e8e6c] [&_h3]:text-[length:12px] [&_h3]:text-[color:#809d5d] max-[760px]:p-[22px]",
  "source-details":
    "[margin:25px_0] [&_>_div]:flex [&_>_div]:justify-between [&_>_div]:gap-[15px] [&_>_div]:[margin:16px_0] [&_>_div]:text-[length:10px] [&_dt]:text-[color:#70865a] [&_dd]:m-[0] [&_dd]:text-[color:#809962]",
  "source-link":
    "flex gap-[8px] items-center text-[length:11px] [margin:20px_0_14px] text-[color:#839f63] no-underline [&:hover]:underline",
  "source-divider": "[border-top:1px_solid_var(--line)] [margin:25px_0]",
  matched:
    "flex items-center gap-[6px] text-[color:#83a661] text-[length:10px]",
  "reference-checks": "[&_.section-heading]:pb-[23px]",
  "login-layout":
    "grid [grid-template-columns:1.1fr_1fr] min-h-[100vh] [background:white] max-[760px]:[grid-template-columns:1fr]",
  "login-visual":
    "[background:#eff4e9] [padding:48px_12%] flex flex-col justify-between gap-[65px] [&_.brand]:p-[0] [&_h1]:text-[length:52px] [&_h1]:leading-[1.15] [&_h1]:font-semibold [&_h1]:text-[color:#3e5940] [&_h1]:tracking-[-2px] [&_h1_em]:[font-family:Georgia,_serif] [&_h1_em]:font-normal [&_h1_em]:text-[color:#799a5b] [&_p:not(.eyebrow)]:max-w-[280px] [&_p:not(.eyebrow)]:text-[color:#72865e] [&_>_small]:flex [&_>_small]:items-center [&_>_small]:gap-[8px] [&_>_small]:text-[length:10px] [&_>_small]:text-[color:#71895c] max-[960px]:p-[40px] max-[960px]:[&_h1]:text-[length:43px] max-[760px]:p-[28px] max-[760px]:gap-[35px] max-[760px]:[&_h1]:text-[length:36px] max-[760px]:[&_.eyebrow]:text-[length:10px] max-[760px]:[&_>_small]:hidden",
  "login-path":
    "flex gap-[17px] text-[color:#8ba475] text-[length:11px] mt-[30px] [&_>_span]:text-[color:#c4d1b4] max-[760px]:[margin:10px_0_0]",
  "login-form":
    "[width:min(340px,_80%)] [align-self:center] [justify-self:center] [&_h2]:text-[length:25px] [&_h2]:text-[color:#527049] [&_h2]:mb-[12px] [&_>_p:not(.eyebrow)]:text-[length:11px] [&_>_p:not(.eyebrow)]:mb-[30px] [&_>_.btn]:w-full [&_>_.btn]:[margin:10px_0_20px] [&_>_small]:block [&_>_small]:text-center [&_>_small]:text-[length:11px] [&_>_small]:text-[color:#abb99b] max-[760px]:[padding:40px_0]",
};
export function tw(names: string) {
  const tokens = names.trim().split(/\s+/).filter(Boolean);
  return [
    ...tokens,
    twMerge(tokens.map((name) => recipes[name] ?? name).join(" ")),
  ].join(" ");
}
