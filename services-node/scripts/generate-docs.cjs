#!/usr/bin/env node
const fs = require('fs')
const PDFDocument = require('pdfkit')
const path = require('path')

const MD_PATH = '/home/dev/simrs-inova/docs/SIMRS_Inova_Dokumentasi_Lengkap.md'
const OUT_DIR = '/home/dev/simrs-inova/docs'

console.log('[1/2] Reading markdown...')
const md = fs.readFileSync(MD_PATH, 'utf-8')
const lines = md.split('\n')

function clean(t) {
  return t.replace(/\*\*(.+?)\*\*/g,'$1').replace(/`(.+?)`/g,'$1').replace(/\[(.+?)\]\(.+?\)/g,'$1').trim()
}

async function genPDF() {
  console.log('[2/3] Generating PDF...')
  const doc = new PDFDocument({ size:'A4', margins:{top:72,bottom:72,left:72,right:72} })
  const out = fs.createWriteStream(path.join(OUT_DIR,'SIMRS_Inova_Basic.pdf'))
  doc.pipe(out)
  let y = 72
  const pw = doc.page.width - 144

  function checkPage(sp) { if (y+sp > doc.page.height-72) { doc.addPage(); y=72 } }
  function section(title) {
    checkPage(60)
    doc.fillColor('#0F8B8D').rect(72,y,pw,4).fill()
    y+=12
    doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(16).text(clean(title),72,y,{width:pw,lineGap:6})
    y+=28
  }
  function subSec(title) {
    checkPage(30)
    doc.fillColor('#0F8B8D').font('Helvetica-Bold').fontSize(12).text(clean(title),72,y,{width:pw,lineGap:4})
    y+=20
  }
  function para(text) {
    if (!text.trim()){ y+=8; return }
    checkPage(20)
    doc.fillColor('#1E293B').font('Helvetica').fontSize(10.5).text(clean(text),72,y,{width:pw,lineGap:4})
    y+=14
  }

  // Cover page
  doc.addPage()
  doc.fillColor('#0F8B8D').rect(0,0,doc.page.width,doc.page.height).fill()
  doc.fillColor('#FFFFFF')
  doc.font('Helvetica-Bold').fontSize(36).text('SIMRS Inova',doc.page.width/2,doc.page.height/2-80,{align:'center'})
  doc.font('Helvetica').fontSize(18).text('Sistem Informasi Manajemen',doc.page.width/2,doc.page.height/2-30,{align:'center'})
  doc.text('Rawat Jalan Terintegrasi',doc.page.width/2,doc.page.height/2-5,{align:'center'})
  doc.fontSize(14).fillColor('#99F6E4').text('Dokumentasi Teknis Lengkap',doc.page.width/2,doc.page.height/2+40,{align:'center'})
  doc.fontSize(11).fillColor('#CBD5E1')
  doc.text('Versi 1.0.0 | November 2026',doc.page.width/2,doc.page.height-120,{align:'center'})
  doc.text('PT Inova Medika Solusindo | Real Case Test Senior Programmer',doc.page.width/2,doc.page.height-100,{align:'center'})

  // TOC
  doc.addPage()
  doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(20).text('Daftar Isi',72,100)
  doc.fillColor('#64748B').font('Helvetica').fontSize(11)
  ['1. Overview Sistem','2. Role-Based Access Control','3. API Endpoints','4. Database Schema',
   '5. Backend Services Node.js','6. Frontend React','7. Instalasi & Deployment',
   '8. Prosedur Pengujian','9. Struktur File','10. Troubleshooting','11. Verifikasi Akhir','12. Lampiran'].forEach((item,i)=>doc.text(`${i+1}. ${item}`,90,145+i*22))

  // Content - simple paragraph rendering
  for (let i = 8; i < lines.length; i++) {
    const L = lines[i]
    if (!L.trim()){ y+=8; continue }
    const m2 = L.match(/^## (.+)$/)
    if (m2){ section(m2[1]); continue }
    const m3 = L.match(/^### (.+)$/)
    if (m3){ subSec(m3[1]); continue }
    // Skip code blocks, tables, ASCII art
    if(L.startsWith('\`\`\`')||L.match(/^\\s*[+\\-]+$/)||L.match(/^\|/)) continue
    para(L)
  }

  await new Promise(r => { out.on('finish', r); doc.end() })
  console.log('   ✅ PDF generated (basic version)')
}

// ── DOCX Generation ───────────────────────────────────────
async function genDOCX() {
  console.log('[3/3] Generating DOCX...')
  const { Document, Paragraph, TextRun, Packer } = require('docx')
  const ch = []
  
  // Cover
  ch.push(new Paragraph({ spacing:{before:200} }))
  ch.push(new Paragraph({ alignment:require('docx').AlignmentType.CENTER, children:[new TextRun({text:'SIMRS Inova',bold:true,size:44,color:'#0F8B8D')}]) })
  ch.push(new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:8}, children:[new TextRun({text:'Sistem Informasi Manajemen Rawat Jalan Terintegrasi',size:26,color:'#334155'})] }))
  ch.push(new Paragraph({ alignment:AlignmentType.CENTER, spacing:{before:40}, children:[new TextRun({text:'Dokumentasi Teknis Lengkap',bold:true,size:28,color:'#0F8B8D')] }))
  ch.push(new Paragraph({ alignment:AlignmentType.CENTER, spacing:{before:20}, children:[new TextRun({text:'Versi 1.0.0  ·  November 2026',size:16,color:'#64748B')] }))
  ch.push(new Paragraph({ alignment:AlignmentType.CENTER, children:[new TextRun({text:'PT Inova Medika Solusindo  ·  Real Case Test Senior Programmer',size:14,color:'#94A3B8')] }))
  ch.push(new Paragraph({ children:[new (require('docx').PageBreak)] }))
  
  // TOC
  ch.push(new Paragraph({ heading:require('docx').HeadingLevel.HEADING_1, children:[new TextRun({text:'Daftar Isi',bold:true,size:28,color:'#1E293B')}]) })
  ['1. Overview Sistem','2. Role-Based Access Control','3. API Endpoints','4. Database Schema',
   '5. Backend Services Node.js','6. Frontend React','7. Instalasi & Deployment',
   '8. Prosedur Pengujian','9. Struktur File','10. Troubleshooting','11. Verifikasi Akhir','12. Lampiran'].forEach(it=>{
    ch.push(new Paragraph({children:[new TextRun({text:it,size:20,color:'#334155')}])})
  })
  ch.push(new Paragraph({children:[new (require('docx').PageBreak] }))
  
  // Content
  const clean = t => t.replace(/\*\*(.+?)\*\*/g,'$1').replace(/`(.+?)`/g,'$1').trim()
  const LINES = fs.readFileSync('/home/dev/simrs-inova/docs/SIMRS_Inova_Dokumentasi_Lengkap.md','utf-8').split('\n')
  for (const L of LINES) {
    if (!L.trim()){ continue }
    const m2 = L.match(/^## (.+)$/)
    if (m2){ ch.push(new Paragraph({heading:require('docx').HeadingLevel.HEADING_1,children:[new TextRun({text:m2[1],bold:true,size:28,color:'#0F8B8D')}])}); continue }
    const m3 = L.match(/^### (.+)$/)
    if (m3){ ch.push(new Paragraph({heading:HeadingLevel.HEADING_2,children:[new TextRun({text:m3[1],bold:true,size:22,color:'#0F8B8D')}])}); continue }
    ch.push(new Paragraph({spacing:{after:120},children:[new TextRun({text:clean(L),size:21,color:'#1E293B')}]}))
  }
  ch.push(new Paragraph({spacing:{before:400}}))
  ch.push(new Paragraph({alignment:require('docx').AlignmentType.CENTER,children:[new TextRun({text:'— Akhir Dokumen —',italics:true,size:18,color:'#64748B')}])})
  
  const doc = new (require('docx').Document({
    styles:{default:{document:{run:{font:'Calibri',size:21}}},paragraphStyles:[
      {id:'H1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:28,bold:true,color:'#0F8B8D'},paragraph:{spacing:{before:360,after:200}} },
      {id:'H2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:22,bold:true,color:'#0F8B8D'},paragraph:{spacing:{before:280,after:160}} }
    ],
    sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1440,right:1440,bottom:1440,left:1440}}}, children:ch }]
  ))
  
  const buf = await Document.Packer.toBuffer(doc)
  fs.writeFileSync('/home/dev/simrs-inova/docs/SIMRS_Inova_Dokumentasi.docx', buf)
  console.log(`   ✅ DOCX generated (${(buf.length/1024).toFixed(1)} KB)`)
}

;(async()=>{ try { await genPDF(); await genDOCX(); console.log('\n✅ Done! Files in', OUT_DIR) } catch(e){ console.error('❌ Error:',e.message); process.exit(1) })()