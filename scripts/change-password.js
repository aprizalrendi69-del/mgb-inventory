const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();


async function main(){

  const username = "admin";

  const newPassword = "adm131214";


  const hash = await bcrypt.hash(
    newPassword,
    10
  );


  await prisma.user.update({

    where:{
      username: username
    },

    data:{
      password: hash
    }

  });


  console.log("Password berhasil diganti menjadi:", newPassword);

}


main()
.then(()=>{

  prisma.$disconnect();

})
.catch((error)=>{

  console.error(error);

  prisma.$disconnect();

});