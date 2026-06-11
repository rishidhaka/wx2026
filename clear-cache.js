// Check what's actually being sent to Firestore
const testObj = {
  phase1: { bracket: { r32: [], r16: [], qf: undefined } },
  phase2: undefined,
  name: "test"
};

function cleanData(obj){
  if(obj===null||obj===undefined)return undefined;
  if(Array.isArray(obj))return obj.map(cleanData).filter(x=>x!==undefined);
  if(typeof obj==="object"){
    const cleaned={};
    for(const key in obj){
      if(Object.prototype.hasOwnProperty.call(obj,key)){
        const val=cleanData(obj[key]);
        if(val!==undefined)cleaned[key]=val;
      }
    }
    return Object.keys(cleaned).length>0?cleaned:undefined;
  }
  return obj;
}

const result = {
  phase1: cleanData(testObj.phase1)||{},
  phase2: cleanData(testObj.phase2)||{},
  name: testObj.name
};

console.log("Result:", JSON.stringify(result, null, 2));
console.log("Has undefined?", JSON.stringify(result).includes("undefined"));
