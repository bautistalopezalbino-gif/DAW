"""Genera docs/plan-plataforma-daw.pdf (plan de la plataforma de apuntes DAW)."""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer,
    Table, TableStyle,
)

FONT_DIR = "/usr/share/fonts/truetype/dejavu"
pdfmetrics.registerFont(TTFont("Sans", f"{FONT_DIR}/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("Sans-Bold", f"{FONT_DIR}/DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Mono", f"{FONT_DIR}/DejaVuSansMono.ttf"))
pdfmetrics.registerFontFamily("Sans", normal="Sans", bold="Sans-Bold")

INK = colors.HexColor("#1f2433")
MUTED = colors.HexColor("#5b6275")
ACCENT = colors.HexColor("#3b5bdb")
LINE = colors.HexColor("#dfe3ec")
SOFT = colors.HexColor("#f4f6fb")

NOTEBOOKS = [
    ("SI", "Sistemas Informáticos", "#e8590c",
     "Hardware, sistemas operativos, redes, comandos Linux/Windows, scripts."),
    ("PRO", "Programación", "#3b5bdb",
     "Java, POO, estructuras de datos, excepciones, ficheros, ejercicios."),
    ("ED", "Entornos de Desarrollo", "#0ca678",
     "IDEs, Git, pruebas (JUnit), depuración, refactorización, UML."),
    ("BD", "Bases de Datos", "#f08c00",
     "Modelo E/R, normalización, SQL (DDL/DML), consultas, PL/SQL."),
    ("LMSGI", "Lenguajes de Marcas y SGI", "#c2255c",
     "HTML, CSS, XML, DTD/XSD, XPath, XSLT, JSON, sistemas de gestión."),
    ("ING", "Inglés", "#7048e8",
     "Vocabulario técnico, gramática, expresiones, listening/speaking."),
    ("PI", "Proyecto Intermodular", "#1098ad",
     "Ideas, requisitos, diario de avance, decisiones técnicas, entregas."),
]

S = {
    "title": ParagraphStyle("title", fontName="Sans-Bold", fontSize=30, leading=36,
                            textColor=INK, spaceAfter=6),
    "subtitle": ParagraphStyle("subtitle", fontName="Sans", fontSize=13, leading=18,
                               textColor=MUTED),
    "h1": ParagraphStyle("h1", fontName="Sans-Bold", fontSize=17, leading=22,
                         textColor=INK, spaceBefore=12, spaceAfter=8),
    "h2": ParagraphStyle("h2", fontName="Sans-Bold", fontSize=12, leading=16,
                         textColor=ACCENT, spaceBefore=10, spaceAfter=4),
    "body": ParagraphStyle("body", fontName="Sans", fontSize=9.8, leading=14.5,
                           textColor=INK, spaceAfter=6),
    "bullet": ParagraphStyle("bullet", fontName="Sans", fontSize=9.8, leading=14,
                             textColor=INK, leftIndent=12, bulletIndent=2,
                             spaceAfter=2),
    "cell": ParagraphStyle("cell", fontName="Sans", fontSize=8.8, leading=12,
                           textColor=INK),
    "cellb": ParagraphStyle("cellb", fontName="Sans-Bold", fontSize=8.8, leading=12,
                            textColor=INK),
    "head": ParagraphStyle("head", fontName="Sans-Bold", fontSize=8.8, leading=12,
                           textColor=colors.white),
    "mono": ParagraphStyle("mono", fontName="Mono", fontSize=8.2, leading=11.5,
                           textColor=INK),
    "small": ParagraphStyle("small", fontName="Sans", fontSize=8.5, leading=12,
                            textColor=MUTED),
    "center": ParagraphStyle("center", fontName="Sans", fontSize=8.5, leading=11,
                             textColor=INK, alignment=TA_CENTER),
}


def P(text, style="body"):
    return Paragraph(text, S[style])


def bullets(items):
    return [Paragraph(i, S["bullet"], bulletText="•") for i in items]


def table(rows, widths, header=True, zebra=True):
    data = []
    for r, row in enumerate(rows):
        style = "head" if header and r == 0 else "cell"
        data.append([c if isinstance(c, Flowable) else P(c, style) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    if header:
        cmds.append(("BACKGROUND", (0, 0), (-1, 0), INK))
    if zebra:
        for r in range(1 if header else 0, len(rows)):
            if r % 2 == 0:
                cmds.append(("BACKGROUND", (0, r), (-1, r), SOFT))
    t.setStyle(TableStyle(cmds))
    return t


class Architecture(Flowable):
    """Diagrama: navegador -> Vercel (hosting) / Supabase (auth, BD, ficheros)."""

    def __init__(self, width):
        super().__init__()
        self.width, self.height = width, 62 * mm

    def box(self, c, x, y, w, h, title, lines, color):
        c.setFillColor(colors.white)
        c.setStrokeColor(color)
        c.setLineWidth(1.2)
        c.roundRect(x, y, w, h, 6, stroke=1, fill=1)
        c.setFillColor(color)
        c.roundRect(x, y + h - 18, w, 18, 6, stroke=0, fill=1)
        c.rect(x, y + h - 18, w, 8, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont("Sans-Bold", 9)
        c.drawCentredString(x + w / 2, y + h - 12.5, title)
        c.setFillColor(INK)
        c.setFont("Sans", 7.8)
        for i, line in enumerate(lines):
            c.drawCentredString(x + w / 2, y + h - 31 - i * 11, line)

    def arrow(self, c, x1, y1, x2, y2, label):
        c.setStrokeColor(MUTED)
        c.setFillColor(MUTED)
        c.setLineWidth(1)
        c.line(x1, y1, x2, y2)
        import math
        a = math.atan2(y2 - y1, x2 - x1)
        for s in (-1, 1):
            c.line(x2, y2, x2 - 6 * math.cos(a + s * 0.4), y2 - 6 * math.sin(a + s * 0.4))
        c.setFont("Sans", 7.2)
        c.drawCentredString((x1 + x2) / 2, (y1 + y2) / 2 + 4, label)

    def draw(self):
        c = self.canv
        w = self.width
        bw, bh = 44 * mm, 40 * mm
        y = 12 * mm
        xs = [0, (w - bw) / 2, w - bw]
        self.box(c, xs[0], y, bw, bh, "Tu navegador",
                 ["Cualquier ordenador", "o móvil", "React + editor TipTap",
                  "Caché offline (PWA)"], INK)
        self.box(c, xs[1], y, bw, bh, "Vercel",
                 ["Aloja la web", "HTTPS gratis", "Despliegue automático",
                  "desde GitHub"], ACCENT)
        self.box(c, xs[2], y, bw, bh, "Supabase",
                 ["Login (email)", "PostgreSQL: apuntes", "Storage: imágenes/PDF",
                  "Seguridad RLS"], colors.HexColor("#0ca678"))
        self.arrow(c, xs[0] + bw, y + bh * 0.62, xs[1], y + bh * 0.62, "app")
        # flecha directa navegador <-> supabase por debajo
        c.setStrokeColor(MUTED)
        c.setDash(3, 2)
        yb = y - 5 * mm
        c.line(xs[0] + bw / 2, y, xs[0] + bw / 2, yb)
        c.line(xs[0] + bw / 2, yb, xs[2] + bw / 2, yb)
        c.line(xs[2] + bw / 2, yb, xs[2] + bw / 2, y)
        c.setDash()
        c.setFillColor(MUTED)
        c.setFont("Sans", 7.2)
        c.drawCentredString(w / 2, yb + 3, "lee y guarda tus apuntes (API segura)")


class Cover(Flowable):
    def __init__(self, width):
        super().__init__()
        self.width, self.height = width, 58 * mm

    def draw(self):
        c = self.canv
        n = len(NOTEBOOKS)
        gap = 4 * mm
        bw = (self.width - gap * (n - 1)) / n
        for i, (code, name, color, _) in enumerate(NOTEBOOKS):
            x = i * (bw + gap)
            h = 40 * mm + (i % 3) * 6 * mm
            c.setFillColor(colors.HexColor(color))
            c.roundRect(x, 0, bw, h, 5, stroke=0, fill=1)
            c.setFillColor(colors.white)
            c.rect(x + 3, 0, 2.2, h, stroke=0, fill=1)
            c.saveState()
            c.translate(x + bw / 2 + 3, 8)
            c.rotate(90)
            c.setFont("Sans-Bold", 9)
            c.drawString(0, -3, code)
            c.restoreState()


def on_page(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setFont("Sans", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(20 * mm, 12 * mm, "Plataforma de apuntes DAW · Plan del proyecto")
        canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, f"{doc.page}")
        canvas.setStrokeColor(LINE)
        canvas.line(20 * mm, 15.5 * mm, A4[0] - 20 * mm, 15.5 * mm)
    canvas.restoreState()


def build(out):
    doc = SimpleDocTemplate(str(out), pagesize=A4, leftMargin=20 * mm,
                            rightMargin=20 * mm, topMargin=20 * mm,
                            bottomMargin=22 * mm, title="Plan · Plataforma de apuntes DAW",
                            author="Bautista López Albino")
    W = doc.width
    st = []

    # ---------- Portada ----------
    st += [Spacer(1, 30 * mm), Cover(W), Spacer(1, 14 * mm),
           P("Cuadernos DAW", "title"),
           P("Plan de la plataforma web para tomar apuntes del Ciclo Superior de "
             "Desarrollo de Aplicaciones Web, accesible desde cualquier ordenador.",
             "subtitle"),
           Spacer(1, 12 * mm)]
    st.append(table([
        ["Documento", "Plan técnico y funcional (v1.0)"],
        ["Fecha", "24 de septiembre de 2026"],
        ["Alumno", "Bautista López Albino"],
        ["Repositorio", "github.com/bautistalopezalbino-gif/DAW"],
    ], [35 * mm, W - 35 * mm], header=False))
    st.append(PageBreak())

    # ---------- 1. Objetivo ----------
    st.append(P("1. Objetivo", "h1"))
    st.append(P("Construir una aplicación web personal en la que organizar todos los "
                "apuntes del curso en <b>7 cuadernos</b>, uno por módulo. Debe poder "
                "abrirse desde cualquier ordenador (casa, instituto, portátil) con un "
                "navegador, sin instalar nada, y los apuntes deben estar siempre "
                "sincronizados y a salvo."))
    st.append(P("Requisitos clave", "h2"))
    st += bullets([
        "<b>Acceso universal:</b> una URL pública con HTTPS; entras con tu email y contraseña.",
        "<b>Sincronización en la nube:</b> lo que escribes en un equipo aparece en todos.",
        "<b>Pensada para informática:</b> bloques de código con resaltado de sintaxis "
        "(Java, SQL, HTML, CSS, XML, Bash…), tablas, listas de tareas e imágenes.",
        "<b>Organización:</b> cuaderno → tema/unidad → apunte, con etiquetas y buscador.",
        "<b>Privacidad:</b> solo tú puedes ver y editar tus apuntes.",
        "<b>Sin coste:</b> todo sobre planes gratuitos (Vercel + Supabase).",
        "<b>Tus datos son tuyos:</b> exportación a Markdown/PDF y copia de seguridad en JSON.",
    ])

    # ---------- 2. Cuadernos ----------
    st.append(P("2. Los 7 cuadernos", "h1"))
    st.append(P("Cada cuaderno tiene color e icono propios y se divide en temas "
                "(por ejemplo, las unidades didácticas del módulo). Se crearán "
                "automáticamente la primera vez que entres."))
    rows = [["", "Cuaderno", "Contenido típico"]]
    for code, name, color, desc in NOTEBOOKS:
        chip = Table([[P(f"<font color='white'><b>{code}</b></font>", "center")]],
                     colWidths=[16 * mm], rowHeights=[7 * mm])
        chip.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(color)),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        rows.append([chip, P(f"<b>{name}</b>", "cell"), desc])
    st.append(table(rows, [20 * mm, 50 * mm, W - 70 * mm]))
    st.append(Spacer(1, 4))
    st.append(P("Plantillas por cuaderno (ideas): <i>Programación</i> → «Ejercicio "
                "resuelto» (enunciado, solución en código, explicación); <i>Bases de "
                "Datos</i> → «Consulta SQL»; <i>Inglés</i> → «Vocabulario» (tabla "
                "palabra / traducción / ejemplo); <i>Proyecto</i> → «Entrada de diario».",
                "small"))
    st.append(PageBreak())

    # ---------- 3. Funcionalidades ----------
    st.append(P("3. Funcionalidades", "h1"))
    st.append(P("Se separan en un <b>MVP</b> (lo mínimo para empezar a usarla en clase) "
                "y mejoras que se añadirán después, por orden de prioridad."))
    st.append(table([
        ["Funcionalidad", "Detalle", "Fase"],
        ["Inicio de sesión", "Registro/login con email y contraseña; sesión recordada.", "MVP"],
        ["Cuadernos y temas", "7 cuadernos fijos; crear, renombrar, ordenar y borrar temas.", "MVP"],
        ["Editor de apuntes", "Texto enriquecido: títulos, negrita, listas, citas, tablas, "
         "checklists, enlaces.", "MVP"],
        ["Bloques de código", "Resaltado de sintaxis por lenguaje y botón de copiar.", "MVP"],
        ["Autoguardado", "Se guarda solo mientras escribes; indicador «Guardado».", "MVP"],
        ["Buscador", "Búsqueda de texto completo en todos los cuadernos.", "MVP"],
        ["Modo oscuro", "Tema claro/oscuro, diseño adaptable a móvil.", "MVP"],
        ["Imágenes y adjuntos", "Pegar capturas y subir PDF/imágenes al apunte.", "2"],
        ["Etiquetas y favoritos", "Etiquetar apuntes (examen, importante, duda…) y fijarlos.", "2"],
        ["Exportar", "Apunte o tema completo a Markdown y PDF; copia total en JSON.", "2"],
        ["Plantillas", "Plantillas por cuaderno (ejercicio, SQL, vocabulario, diario).", "3"],
        ["Tarjetas de repaso", "Crear flashcards desde los apuntes para estudiar exámenes.", "3"],
        ["Calendario", "Fechas de exámenes y entregas por módulo.", "3"],
        ["Modo offline (PWA)", "Instalar como app y leer apuntes sin conexión.", "3"],
    ], [38 * mm, W - 38 * mm - 16 * mm, 16 * mm]))

    st.append(PageBreak())

    # ---------- 4. Arquitectura ----------
    st.append(P("4. Arquitectura y tecnologías", "h1"))
    st.append(Architecture(W))
    st.append(Spacer(1, 4))
    st.append(table([
        ["Capa", "Tecnología", "Por qué"],
        ["Interfaz", "React + TypeScript + Vite", "Estándar del sector, rápido y relacionado "
         "con lo que verás en DAW."],
        ["Estilos", "Tailwind CSS", "Diseño limpio y adaptable a móvil sin CSS repetitivo."],
        ["Editor", "TipTap (ProseMirror) + lowlight", "Editor tipo Notion con bloques de "
         "código resaltados."],
        ["Backend", "Supabase", "Login, base de datos PostgreSQL y almacenamiento de "
         "ficheros sin montar un servidor."],
        ["Hosting", "Vercel", "Publica la web gratis con HTTPS; se redepliega en cada push."],
        ["Código", "GitHub (este repositorio)", "Historial de cambios y despliegue continuo."],
    ], [24 * mm, 48 * mm, W - 72 * mm]))
    st.append(Spacer(1, 10))

    # ---------- 5. Modelo de datos ----------
    st.append(P("5. Modelo de datos", "h1"))
    st.append(P("Base de datos PostgreSQL en Supabase. Todas las tablas llevan "
                "<font name='Mono'>user_id</font> y políticas <b>RLS</b> (Row Level "
                "Security), de modo que cada usuario solo puede leer y escribir sus "
                "propias filas, aunque alguien conozca la URL de la API."))
    st.append(table([
        ["Tabla", "Campos principales", "Relación"],
        ["notebooks", "id, user_id, slug, name, color, icon, position", "7 por usuario"],
        ["sections", "id, notebook_id, title, position", "N por cuaderno (temas)"],
        ["notes", "id, section_id, title, content (JSON), content_text, pinned, "
         "created_at, updated_at", "N por tema"],
        ["tags", "id, user_id, name, color", "—"],
        ["note_tags", "note_id, tag_id", "N:M notas–etiquetas"],
        ["attachments", "id, note_id, path, mime, size", "Ficheros en Storage"],
    ], [26 * mm, W - 26 * mm - 38 * mm, 38 * mm]))
    st.append(Spacer(1, 4))
    st.append(P("<font name='Mono'>content</font> guarda el documento del editor en JSON "
                "(fiel al formato) y <font name='Mono'>content_text</font> una versión "
                "en texto plano indexada con búsqueda de texto completo en español "
                "(<font name='Mono'>tsvector</font>).", "small"))

    # ---------- 6. Pantallas ----------
    st.append(P("6. Pantallas", "h1"))
    st.append(table([
        ["Pantalla", "Qué contiene"],
        ["Login", "Email y contraseña, registro y recuperación de contraseña."],
        ["Inicio", "Los 7 cuadernos como tarjetas de color, apuntes recientes y fijados."],
        ["Cuaderno", "Barra lateral con los temas; lista de apuntes del tema seleccionado."],
        ["Apunte", "Editor a pantalla completa con barra de formato, etiquetas y estado de "
         "guardado."],
        ["Buscar", "Resultados de todos los cuadernos con el texto resaltado (atajo Ctrl+K)."],
        ["Ajustes", "Tema claro/oscuro, exportar e importar copia de seguridad, cerrar sesión."],
    ], [30 * mm, W - 30 * mm]))
    st.append(Spacer(1, 6))
    layout = Table([
        [P("<b>Cuadernos</b><br/>● SI<br/>● PRO<br/>● ED<br/>● BD<br/>● LMSGI<br/>"
           "● ING<br/>● PI", "cell"),
         P("<b>Temas</b><br/>UD1 Introducción<br/>UD2 Variables<br/>UD3 Bucles<br/>"
           "UD4 POO…", "cell"),
         P("<b>UD3 · Bucles en Java</b><br/><font color='#5b6275'>Guardado ✓</font>"
           "<br/><br/>El bucle <i>for</i> se usa cuando…<br/><font name='Mono' "
           "size='8'>for (int i = 0; i &lt; 10; i++) { … }</font>", "cell")],
    ], colWidths=[32 * mm, 42 * mm, W - 74 * mm], rowHeights=[46 * mm])
    layout.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, MUTED),
        ("LINEAFTER", (0, 0), (1, 0), 0.5, LINE),
        ("BACKGROUND", (0, 0), (0, 0), SOFT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ]))
    st.append(KeepTogether([P("Boceto de la vista principal (escritorio)", "h2"), layout]))
    st.append(PageBreak())

    # ---------- 7. Seguridad ----------
    st.append(P("7. Seguridad y copias de seguridad", "h1"))
    st += bullets([
        "Contraseñas gestionadas por Supabase Auth (nunca se guardan en claro).",
        "RLS en todas las tablas y en el bucket de ficheros: acceso solo a lo propio.",
        "Las claves públicas van en variables de entorno de Vercel, nunca en el código.",
        "Supabase hace copias diarias; además, botón de «Exportar todo» a JSON/Markdown.",
        "Opción de desactivar el registro público cuando tengas tu cuenta creada.",
    ])

    # ---------- 8. Fases ----------
    st.append(P("8. Plan de construcción por fases", "h1"))
    st.append(P("Cada fase termina con algo usable y desplegado. Trabajaremos en este "
                "repositorio y cada fase se sube a GitHub."))
    st.append(table([
        ["Fase", "Qué se hace", "Resultado"],
        ["0 · Preparación", "Proyecto React + Vite + TS + Tailwind, estructura de carpetas, "
         "linter, README.", "Web vacía funcionando en local"],
        ["1 · Backend", "Proyecto Supabase, tablas, RLS, script SQL de migración, login.",
         "Puedes registrarte y entrar"],
        ["2 · Cuadernos", "Inicio con los 7 cuadernos, barra lateral, CRUD de temas y apuntes.",
         "Estructura navegable"],
        ["3 · Editor", "TipTap con formato, tablas, checklists, código resaltado y "
         "autoguardado.", "Ya puedes tomar apuntes"],
        ["4 · Despliegue", "Publicar en Vercel con variables de entorno; probar desde otro "
         "equipo.", "<b>MVP online en una URL</b>"],
        ["5 · Búsqueda y UX", "Buscador global (Ctrl+K), modo oscuro, móvil, fijados, "
         "recientes.", "Uso diario cómodo"],
        ["6 · Extras", "Imágenes/adjuntos, etiquetas, exportar, plantillas, flashcards, "
         "calendario, PWA.", "Plataforma completa"],
    ], [30 * mm, W - 30 * mm - 45 * mm, 45 * mm]))

    st.append(P("Estructura del repositorio", "h2"))
    st.append(P("DAW/<br/>"
                "├─ docs/ ........................ este plan<br/>"
                "├─ supabase/migrations/ ... esquema SQL y políticas RLS<br/>"
                "├─ src/<br/>"
                "│  ├─ components/ ........ interfaz (Sidebar, Editor, NoteList…)<br/>"
                "│  ├─ pages/ .................. Login, Inicio, Cuaderno, Apunte, Ajustes<br/>"
                "│  ├─ lib/ ..................... cliente Supabase, búsqueda, exportación<br/>"
                "│  └─ data/notebooks.ts .. definición de los 7 cuadernos<br/>"
                "└─ package.json, vite.config.ts, README.md", "mono"))

    # ---------- 9. Qué necesito ----------
    st.append(P("9. Qué necesito de ti", "h1"))
    st += bullets([
        "Una <b>cuenta gratuita en Supabase</b> (supabase.com, puedes entrar con GitHub) y "
        "crear un proyecto; me pasarás la <i>URL</i> y la <i>anon key</i> (son públicas).",
        "Una <b>cuenta en Vercel</b> vinculada a GitHub para publicar la web.",
        "Confirmar o ajustar: nombres de los cuadernos, colores y las funcionalidades del MVP.",
        "(Opcional) Las unidades didácticas de cada módulo para crear los temas de inicio.",
    ])
    st.append(Spacer(1, 6))
    st.append(P("<b>Siguiente paso:</b> cuando des el visto bueno a este plan, empezamos "
                "por la Fase 0 y la Fase 1.", "body"))

    doc.build(st, onFirstPage=on_page, onLaterPages=on_page)


if __name__ == "__main__":
    out = Path(__file__).with_name("plan-plataforma-daw.pdf")
    build(out)
    print(out)
