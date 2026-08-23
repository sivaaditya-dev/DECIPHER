# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
project = 'Decipher'
copyright = '2026, Siva Aditya'
author = 'Siva Aditya'
release = '1.0.0'
version = '1.0'

# -- General configuration ---------------------------------------------------
extensions = [
    'myst_parser',          # Parse Markdown (.md) files as RST
    'sphinx.ext.githubpages',
]

# Support both .rst and .md source files
source_suffix = {
    '.rst': 'restructuredtext',
    '.md':  'markdown',
}

templates_path = ['_templates']
exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']

# -- Options for HTML output -------------------------------------------------
html_theme = 'sphinx_rtd_theme'

html_theme_options = {
    'logo_only': False,
    'prev_next_buttons_location': 'bottom',
    'style_external_links': False,
    'collapse_navigation': False,
    'sticky_navigation': True,
    'navigation_depth': 4,
    'includehidden': True,
    'titles_only': False,
    'style_nav_header_background': '#0f172a',
}

html_static_path = ['_static']

html_css_files = ['custom.css']

# Project logo / favicon
# html_logo = '_static/logo.png'
# html_favicon = '_static/favicon.ico'

html_title = 'Decipher — AI Vocabulary Learning App'

# MyST settings
myst_enable_extensions = [
    'colon_fence',
    'deflist',
    'tasklist',
]
