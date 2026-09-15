import PDFDocument from "pdfkit";


export function createPDF(){

const doc =
new PDFDocument({

size:"A4",

margin:50

});


return doc;

}