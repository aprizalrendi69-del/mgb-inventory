import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
async function currentUser() {
  const c = await cookies(); const s = c.get("erp-session") || c.get("session"); if (!s) return null;
  let id = 0; try { const db = await prisma.session.findUnique({ where: { token: s.value }, select: { expiresAt: true, user: { select: { id: true } } } }); if (db) { if (db.expiresAt <= new Date()) return null; id = db.user.id; } } catch {}
  if (!id) { try { const x = JSON.parse(s.value); id = Number(x?.user?.id ?? x?.id ?? 0); } catch { return null; } }
  if (!Number.isInteger(id) || id <= 0) return null; return prisma.user.findUnique({ where: { id }, select: { id: true, role: true, active: true } }).then(u => u?.active ? u : null);
}
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser(); if (!user) return NextResponse.json({ success:false,message:"Tidak login." },{status:401});
    if (!["ADMIN","MANAGER"].includes(String(user.role).toUpperCase())) return NextResponse.json({success:false,message:"Anda tidak memiliki akses untuk reject Waste Pusat."},{status:403});
    const id=Number((await context.params).id); if(!Number.isInteger(id)||id<=0)return NextResponse.json({success:false,message:"ID Waste tidak valid."},{status:400});
    const body=await req.json().catch(()=>({})); const reason=typeof body?.reason==="string"?body.reason.trim():""; if(reason.length<3)return NextResponse.json({success:false,message:"Alasan reject wajib diisi (minimal 3 karakter)."},{status:400});
    const result=await prisma.$transaction(async tx=>{
      const waste=await tx.stockWaste.findUnique({where:{id}}); if(!waste)throw new Error("Data Waste tidak ditemukan."); if(waste.status!=="PENDING")throw new Error(`Waste sudah berstatus ${waste.status}.`);
      const note=waste.note?`${waste.note}\nAlasan Reject: ${reason}`:`Alasan Reject: ${reason}`;
      const updated=await tx.stockWaste.updateMany({where:{id,status:"PENDING"},data:{status:"REJECTED",note}}); if(updated.count!==1)throw new Error("Waste sudah diproses atau statusnya sudah berubah.");
      await tx.history.create({data:{transactionType:"ADJUSTMENT",referenceNumber:waste.number,userId:user.id,description:`Reject Waste Pusat ${waste.number}. Alasan: ${reason}`}});
      return tx.stockWaste.findUnique({where:{id}});
    });
    return NextResponse.json({success:true,message:"Waste Pusat berhasil ditolak.",data:result});
  } catch(e:any){console.error("CENTRAL WASTE REJECT ERROR:",e);return NextResponse.json({success:false,message:e?.message||"Gagal reject Waste Pusat."},{status:400});}
}
