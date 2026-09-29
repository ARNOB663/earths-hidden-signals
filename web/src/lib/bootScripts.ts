// Tiny scripts that run in <head> before the first paint (theme and language), so the page
// doesn't flash the wrong colours or language. Plain strings, safe to import from server code.

/** Runs before first paint so the page never flashes the wrong theme. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("theme")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.themePref=p;r.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

/** Runs before first paint, so a saved Bangla choice applies without a flash where possible. */
export const LANG_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("lang")==="bn")document.documentElement.lang="bn";}catch(e){}})();`;
