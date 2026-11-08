// Decide, antes da primeira pintura, se a animação de entrada aparece. Fica fora do componente (que é "use client")
// porque o layout do servidor precisa do texto do script: de um ficheiro "use client" só lhe chegava uma referência.

export const INTRO_KEY = "msx-intro";
/** quando a entrada apareceu pela última vez (guardado no aparelho, não só na sessão) */
export const INTRO_AT_KEY = "msx-intro-at";
/** neste aparelho entra o super-administrador: a entrada aparece sempre que a app abre (ver client-layout) */
export const INTRO_ALWAYS_KEY = "msx-intro-always";
/** pede para a entrada tocar outra vez (ao entrar com a senha, para o super-administrador) */
export const INTRO_PLAY_EVENT = "msx-play-intro";

/**
 * Uma vez por dia, em cada aparelho: aparece na primeira abertura do dia (dia do calendário, hora local) e no resto do
 * dia a app abre directo ao trabalho. Antes voltava a cada 30 minutos, e quem abre a app dezenas de vezes por dia
 * via-a vezes demais. Nunca em testes automáticos nem nas páginas legais; `?intro=1` mostra-a sempre.
 * Sem acesso ao localStorage (navegação privada) vale a sessão: aparece uma vez por visita.
 * O super-administrador vê-a sempre que abre a app (uma vez por sessão: recarregar não a repete) e ao entrar.
 */
export const INTRO_GATE = `try{var d=document.documentElement,q=/[?&]intro=1/.test(location.search),seen;try{var t=+localStorage.getItem('${INTRO_AT_KEY}')||0;seen=localStorage.getItem('${INTRO_ALWAYS_KEY}')==='1'?!!sessionStorage.getItem('${INTRO_KEY}'):!!t&&new Date(t).toDateString()===new Date().toDateString()}catch(e){seen=!!sessionStorage.getItem('${INTRO_KEY}')}if(!q&&(seen||navigator.webdriver||/^\\/(privacidade|termos)/.test(location.pathname)))d.dataset.intro='skip'}catch(e){document.documentElement.dataset.intro='skip'}`;
