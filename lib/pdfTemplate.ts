import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY } from "./company";

export function createPDF(title: string) {

  const doc = new jsPDF("p","mm","a4");

  doc.setFontSize(16);
  doc.text(COMPANY.name,105,15,{align:"center"});

  doc.setFontSize(10);
  doc.text(COMPANY.address,105,21,{align:"center"});
  doc.text(COMPANY.phone,105,26,{align:"center"});

  doc.setLineWidth(.5);
  doc.line(10,30,200,30);

  doc.setFontSize(15);
  doc.text(title,105,38,{align:"center"});

  return doc;

}

export { autoTable };