import { NextRequest, NextResponse } from "next/server";


export function proxy(request: NextRequest) {

  const pathname = request.nextUrl.pathname;


  // halaman bebas login
  const publicPaths = [
    "/login",
    "/api/login",
    "/api/logout",
    "/favicon.ico",
  ];


  if (
    publicPaths.some((path)=>pathname.startsWith(path))
  ){
    return NextResponse.next();
  }


  // abaikan asset next
  if(
    pathname.startsWith("/_next")
  ){
    return NextResponse.next();
  }



  const session =
    request.cookies.get("erp-session");



  console.log(
    "CHECK SESSION :",
    session?.value
  );



  if(!session){

    return NextResponse.redirect(
      new URL(
        "/login",
        request.url
      )
    );

  }



  return NextResponse.next();

}



export const config = {

 matcher:[
   "/((?!_next/static|_next/image).*)"
 ]

};