// Centralized DOM event registration. Event behavior stays in feature controllers.
export function listen(target,type,handler,options){
 if(!target||typeof target.addEventListener!=="function")return ()=>{};
 target.addEventListener(type,handler,options);
 return ()=>target.removeEventListener(type,handler,options);
}
