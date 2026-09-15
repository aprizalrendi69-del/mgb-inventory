import jwt from "jsonwebtoken";


const SECRET =
process.env.JWT_SECRET || "MGB_SECRET";


export function createToken(data:any){

return jwt.sign(
data,
SECRET,
{
expiresIn:"1d"
}
);

}



export function verifyToken(token:string){

return jwt.verify(
token,
SECRET
);

}
