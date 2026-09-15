import {
 PrismaClient,
 Role
} from "@prisma/client";

import bcrypt from "bcryptjs";


const prisma = new PrismaClient();


async function main(){


await prisma.user.deleteMany();


const password =
await bcrypt.hash(
"123456",
10
);



await prisma.user.create({

data:{

username:"admin",

password:password,

fullname:"Administrator",

role:Role.ADMIN

}

});


console.log("ADMIN CREATED");

}


main()
.then(async()=>{
 await prisma.$disconnect();
})
.catch(async(e)=>{
 console.error(e);
 await prisma.$disconnect();
 process.exit(1);
});