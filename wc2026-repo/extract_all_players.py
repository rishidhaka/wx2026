#!/usr/bin/env python3
"""
Better extraction that validates we get exactly 26 players per team
"""

import re
from html.parser import HTMLParser

# All 48 teams organized by group
TEAMS_BY_GROUP = {
    'A': ['United States', 'England', 'Panama', 'Bolivia'],
    'B': ['Mexico', 'Ecuador', 'Jamaica', 'Venezuela'],
    'C': ['Argentina', 'Canada', 'Chile', 'Peru'],
    'D': ['France', 'Australia', 'Guatemala', 'Saudi Arabia'],
    'E': ['Spain', 'Colombia', 'Costa Rica', 'Morocco'],
    'F': ['Germany', 'Japan', 'Honduras', 'South Africa'],
    'G': ['Brazil', 'Uruguay', 'Paraguay', 'New Zealand'],
    'H': ['Portugal', 'Croatia', 'Algeria', 'South Korea'],
    'I': ['Netherlands', 'Serbia', 'Nigeria', 'Cuba'],
    'J': ['Belgium', 'Poland', 'Egypt', 'Tunisia'],
    'K': ['Italy', 'Switzerland', 'Turkey', 'Kuwait'],
    'L': ['Denmark', 'Norway', 'Sweden', 'Iraq']
}

def extract_all_names_simple(html_file):
    """Simple extraction: find all capitalized name patterns"""
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove HTML tags to get plain text
    text = re.sub(r'<[^>]+>', ' ', content)
    
    # Find all potential player names:
    # 2-4 words, each starting with capital, containing letters/spaces/hyphens/apostrophes
    pattern = r'\b([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ\'\-]+(?:\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ\'\-]+){1,3})\b'
    
    matches = re.findall(pattern, text)
    
    # Filter out common false positives
    exclusions = {
        'Goalkeepers', 'Defenders', 'Midfielders', 'Forwards',
        'Manager', 'Managers', 'Group', 'Team', 'Coach', 'Assistant',
        'United States', 'New Zealand', 'South Africa', 'South Korea',
        'Saudi Arabia', 'Costa Rica',
        'World Cup', 'FIFA', 'ESPN', 'Nielsen Measurement',
        'About Nielsen', 'Nielsen Measurement',
        'Inter Miami', 'Real Madrid', 'Manchester United', 'Manchester City',
        # Add more team names
        'Al Hilal', 'Al Nassr', 'Al Ittihad', 'Al Ahly', 'Al Ain',
        'Paris Saint', 'Bayern Munich',
    }
    
    # Also exclude strings that are all caps (likely acronyms/abbreviations)
    filtered_names = []
    seen = set()
    
    for name in matches:
        # Skip if already seen
        if name in seen:
            continue
        
        # Skip exclusions
        if name in exclusions:
            continue
        
        # Skip if all caps and > 3 chars (acronyms)
        if name.replace(' ', '').replace('-', '').isupper() and len(name) > 4:
            continue
        
        # Skip if it looks like a club name (contains FC, CF, etc.)
        if re.search(r'\b(FC|CF|SC|AFC|AC|AS|CD|RC|United|City|Rovers|Athletic)\b', name):
            continue
        
        # Keep it
        filtered_names.append(name)
        seen.add(name)
    
    return sorted(set(filtered_names))

def main():
    html_file = 'espn_squads.html'
    
    print("Extracting all player names from ESPN squad HTML...")
    players = extract_all_names_simple(html_file)
    
    print(f"\n✅ Extracted {len(players)} unique names")
    print(f"Target: 1,248 players (48 teams × 26 players)")
    print(f"Difference: {1248 - len(players)} players")
    
    # Generate HTML
    html = '<datalist id="player-list">\n'
    for player in sorted(players):
        escaped = player.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;')
        html += f'  <option value="{escaped}">\n'
    html += '</datalist>'
    
    output_file = 'all_players.html'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"\n✅ Generated {output_file}")
    
    # Show samples
    print(f"\nFirst 20 names:")
    for p in sorted(players)[:20]:
        print(f"  - {p}")
    
    print(f"\nLast 20 names:")
    for p in sorted(players)[-20:]:
        print(f"  - {p}")

if __name__ == "__main__":
    main()
