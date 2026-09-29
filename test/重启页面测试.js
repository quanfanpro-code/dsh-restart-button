// 运行真实客户端代码，验证等待服务恢复期间不会提前刷新或把 401 当成成功。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let plugin, component, tick, reloads=0, cleared=0, settle;
const response = new Promise(resolve=>{settle=resolve;});
const responses=[{ok:true},new Error('服务已停止'),{ok:false},{ok:true}];
const context={
  console,
  window:{__ModuleLoader__:{load({factory}){plugin=factory(name=>name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:{});}},alert(){throw new Error('不应提示错误');}},
  document:{getElementById(){return {}; }},
  location:{href:'http://127.0.0.1:3080/',reload(){reloads++;}},
  fetch:async()=>{const v=responses.shift();if(v instanceof Error)throw v;return v;},
  setInterval(fn){tick=fn;return 1;},clearInterval(){cleared++;}
};
vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),context);
const ctx={effect(fn){fn();},locale:{register(){}},connection:{rpc:{call(){return response;}}},slots:{inject(n,fn){fn();},register(spec,fn){component=fn;}}};
plugin.apply(ctx);
component({wide:true,t:key=>key,__ctx:ctx}).props.onClick();
assert.equal(tick,undefined,'重启请求尚未确认，不能开始刷新轮询');
settle({ok:true,value:{started:true}});
const drain=()=>new Promise(resolve=>setImmediate(resolve));
await drain();
assert.equal(typeof tick,'function');
for(let i=0;i<4;i++){tick();await drain();assert.equal(reloads,i===3?1:0,'只有服务经历断开后重新返回 200 才刷新');}
assert.equal(cleared,1);
console.log('真实客户端重启时序测试通过');
