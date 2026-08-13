import os
import csv
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

def generate_pdf_report(report_data: dict, output_path: str) -> str:
    """Generate a PDF integrity report."""
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Normal'],
        fontSize=22,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#0a0e1a'),
        spaceAfter=6,
        alignment=TA_CENTER
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=11,
        fontName='Helvetica',
        textColor=colors.HexColor('#64748b'),
        spaceAfter=4,
        alignment=TA_CENTER
    )
    section_style = ParagraphStyle(
        'Section',
        parent=styles['Normal'],
        fontSize=13,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#1e2d4a'),
        spaceBefore=12,
        spaceAfter=4
    )
    label_style = ParagraphStyle(
        'Label',
        parent=styles['Normal'],
        fontSize=9,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#64748b'),
        spaceAfter=2
    )
    value_style = ParagraphStyle(
        'Value',
        parent=styles['Normal'],
        fontSize=10,
        fontName='Helvetica',
        textColor=colors.HexColor('#0a0e1a'),
        spaceAfter=6
    )
    hash_style = ParagraphStyle(
        'Hash',
        parent=styles['Normal'],
        fontSize=8,
        fontName='Courier',
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=6,
        wordWrap='CJK'
    )

    status_color = colors.HexColor('#16a34a') if report_data.get('status') == 'VERIFIED' else colors.HexColor('#dc2626')
    status_bg = colors.HexColor('#f0fdf4') if report_data.get('status') == 'VERIFIED' else colors.HexColor('#fef2f2')

    story = []

    # Header
    story.append(Paragraph("FILE INTEGRITY REPORT", title_style))
    story.append(Paragraph("Cybersecurity File Monitoring & Tamper Detection System", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1e2d4a'), spaceAfter=12))
    story.append(Spacer(1, 4*mm))

    # Status banner
    status_label = "✓ INTEGRITY VERIFIED" if report_data.get('status') == 'VERIFIED' else "⚠ FILE MODIFICATION DETECTED"
    status_table = Table([[Paragraph(status_label, ParagraphStyle(
        'Status',
        parent=styles['Normal'],
        fontSize=14,
        fontName='Helvetica-Bold',
        textColor=status_color,
        alignment=TA_CENTER
    ))]], colWidths=[170*mm])
    status_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), status_bg),
        ('BOX', (0, 0), (-1, -1), 1.5, status_color),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('ROUNDEDCORNERS', [4]),
    ]))
    story.append(status_table)
    story.append(Spacer(1, 6*mm))

    # File information
    story.append(Paragraph("FILE INFORMATION", section_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=6))

    info_data = [
        ["File Name", report_data.get('file_name', 'N/A')],
        ["File Size", _format_size(report_data.get('file_size', 0))],
        ["File Type", report_data.get('file_type', 'N/A')],
        ["Hash Algorithm", report_data.get('algorithm', 'N/A').upper()],
    ]

    info_table = Table(info_data, colWidths=[50*mm, 120*mm])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#64748b')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#0a0e1a')),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 4*mm))

    # Hash values
    story.append(Paragraph("HASH COMPARISON", section_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=6))

    story.append(Paragraph("Trusted Baseline Hash:", label_style))
    story.append(Paragraph(report_data.get('trusted_hash', 'N/A'), hash_style))
    story.append(Paragraph("Current File Hash:", label_style))
    story.append(Paragraph(report_data.get('current_hash', 'N/A'), hash_style))

    hashes_match = report_data.get('trusted_hash') == report_data.get('current_hash')
    match_color = colors.HexColor('#16a34a') if hashes_match else colors.HexColor('#dc2626')
    match_label = "Hashes Match" if hashes_match else "Hash Mismatch Detected"

    story.append(Paragraph(match_label, ParagraphStyle(
        'Match',
        parent=styles['Normal'],
        fontSize=10,
        fontName='Helvetica-Bold',
        textColor=match_color,
        spaceAfter=6
    )))
    story.append(Spacer(1, 4*mm))

    # Scan metadata
    story.append(Paragraph("SCAN INFORMATION", section_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=6))

    scan_data = [
        ["Scan Date", report_data.get('scan_date', datetime.now().strftime('%d-%b-%Y %H:%M:%S'))],
        ["Scan Type", report_data.get('scan_type', 'Manual Verification')],
        ["Generated By", report_data.get('user_name', 'System User')],
        ["Report ID", report_data.get('report_id', 'N/A')],
    ]

    scan_table = Table(scan_data, colWidths=[50*mm, 120*mm])
    scan_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#64748b')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#0a0e1a')),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(scan_table)
    story.append(Spacer(1, 6*mm))

    # Footer
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=6))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        fontName='Helvetica',
        textColor=colors.HexColor('#94a3b8'),
        alignment=TA_CENTER
    )
    story.append(Paragraph(
        "File Integrity Checker – Cybersecurity File Monitoring & Tamper Detection System",
        footer_style
    ))
    story.append(Paragraph(
        f"Report generated on {datetime.now().strftime('%d %B %Y at %H:%M:%S')}",
        footer_style
    ))

    doc.build(story)
    return output_path


def generate_csv_report(report_data: dict) -> str:
    """Generate a CSV integrity report string."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(['FILE INTEGRITY REPORT'])
    writer.writerow(['Generated', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
    writer.writerow([])
    writer.writerow(['Field', 'Value'])
    writer.writerow(['File Name', report_data.get('file_name', 'N/A')])
    writer.writerow(['File Size', _format_size(report_data.get('file_size', 0))])
    writer.writerow(['File Type', report_data.get('file_type', 'N/A')])
    writer.writerow(['Hash Algorithm', report_data.get('algorithm', 'N/A').upper()])
    writer.writerow(['Trusted Hash', report_data.get('trusted_hash', 'N/A')])
    writer.writerow(['Current Hash', report_data.get('current_hash', 'N/A')])
    writer.writerow(['Status', report_data.get('status', 'N/A')])
    writer.writerow(['Scan Date', report_data.get('scan_date', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))])
    writer.writerow(['Scan Type', report_data.get('scan_type', 'Manual Verification')])
    writer.writerow(['Generated By', report_data.get('user_name', 'System User')])
    writer.writerow(['Report ID', report_data.get('report_id', 'N/A')])

    return output.getvalue()


def _format_size(size_bytes: int) -> str:
    """Format file size to human readable."""
    if size_bytes == 0:
        return '0 B'
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"
