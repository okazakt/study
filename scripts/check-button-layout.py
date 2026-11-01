"""Check the actual button boxes in WebKit, including iPhone-like safe areas.
Requires Python Playwright and its WebKit browser: python3 scripts/check-button-layout.py
This loads the real HTML/CSS without the game/audio JavaScript.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
markup = (root / 'index.html').read_text()
markup = re.sub(r'<script\b.*?</script>', '', markup, flags=re.S)
markup = re.sub(r'<link rel="stylesheet"[^>]*>', '', markup)
markup = markup.replace('</head>', '<style>' + (root / 'style.css').read_text() + '</style></head>')

with sync_playwright() as playwright:
    browser = playwright.webkit.launch(headless=True)
    for width, height, top, bottom in [(459, 938, 0, 34), (390, 844, 47, 34), (320, 844, 47, 34)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True)
        page.set_content(markup)
        page.evaluate('''({top,bottom})=>{
          document.documentElement.classList.add('play-locked');document.body.classList.add('playing');
          for(const name of ['home','result','practice-review','tuning'])document.getElementById(name).hidden=true;
          document.getElementById('play').hidden=false;
          document.documentElement.style.setProperty('--screen-safe-top',top+'px');
          document.documentElement.style.setProperty('--screen-safe-bottom',bottom+'px');
          document.getElementById('question-slot').style.height='150px';
        }''', {'top': top, 'bottom': bottom})
        result = page.evaluate('''()=>{
          const parent=document.querySelector('.lane-keys').getBoundingClientRect();
          const controls=[...document.querySelectorAll('[data-lane]')].map(button=>{
            const r=button.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right};
          });return {parentBottom:parent.bottom,parentHeight:parent.height,controls};
        }''')
        assert abs(result['parentBottom'] - height) < .1, result
        for button in result['controls']:
            assert abs(button['bottom'] - result['parentBottom']) < .1, result
            assert abs(button['height'] - result['parentHeight']) < .1, result
        for left, right in zip(result['controls'], result['controls'][1:]):
            assert abs(right['left'] - left['right'] - 6) < .1, result
        print(f'PASS WebKit {width}x{height}: every button fills {result["parentHeight"]}px; bottom gap=0')
        page.close()
    browser.close()
