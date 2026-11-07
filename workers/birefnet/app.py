import os,secrets
from fastapi import FastAPI,UploadFile,File,Form,Header,HTTPException
app=FastAPI(title="Soft3TT BiRefNet worker")
TOKEN=os.getenv("WORKER_TOKEN","")
@app.get("/health")
def health(): return {"ok":True,"inference_ready":False}
@app.post("/v1/remove-background")
async def remove(file:UploadFile=File(...),mode:str=Form("transparent"),backgroundColor:str=Form("#ffffff"),authorization:str|None=Header(default=None)):
 if not TOKEN or not authorization or not secrets.compare_digest(authorization,"Bearer "+TOKEN): raise HTTPException(401,"Unauthorized")
 if file.content_type not in {"image/jpeg","image/png","image/webp"}: raise HTTPException(415,"Unsupported image")
 data=await file.read(15*1024*1024+1)
 if len(data)>15*1024*1024: raise HTTPException(413,"Image too large")
 raise HTTPException(501,"BiRefNet inference and private output storage are not installed yet")
