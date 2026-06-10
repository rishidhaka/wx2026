#!/usr/bin/env python3
"""
Extract players using the structured position format from ESPN
Goalkeepers: Player1, Player2, Player3
Defenders: Player4, Player5, etc.
"""

import re

def extract_players_from_positions(html_file):
    """Extract players from position-labeled sections"""
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    all_players = set()
    
    # Remove all HTML tags to get clean text
    text = re.sub(r'<[^>]+>', '\n', content)
    
    # Find all position sections with their player lists
    # Pattern: "Position:" followed by comma-separated names
    position_pattern = r'(Goalkeepers?|Defenders?|Midfielders?|Forwards?)\s*:?\s*([^\n]+(?:\n(?![A-Z][a-z]+:)[^\n]+)*)'
    
    matches = re.findall(position_pattern, text, re.MULTILINE)
    
    print(f"Found {len(matches)} position sections")
    
    for position, players_text in matches:
        # Split by commas to get individual players
        # Also split by semicolons or newlines as backup separators
        players_text = players_text.replace(';', ',').replace('\n', ' ')
        
        player_names = [p.strip() for p in players_text.split(',')]
        
        for name in player_names:
            # Clean up the name
            name = name.strip()
            
            # Skip if empty or too short
            if len(name) < 3:
                continue
            
            # Skip if it looks like a position label
            if name in ['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards', 'Manager']:
                continue
            
            # Remove club names in parentheses: "Player Name (Club)" -> "Player Name"
            name = re.sub(r'\s*\([^)]+\)\s*$', '', name).strip()
            
            # Skip if it's not a proper name pattern (must have at least one capital letter)
            if not re.search(r'[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ]', name):
                continue
            
            # Skip if it's too long (likely not a player name)
            if len(name) > 40:
                continue
            
            # Add to our set
            if name:
                all_players.add(name)
    
    return sorted(all_players)

def main():
    html_file = 'espn_squads.html'
    
    print("Extracting players from position-based structure...\n")
    players = extract_players_from_positions(html_file)
    
    print(f"\n✅ Extracted {len(players)} unique players")
    print(f"Target: 1,248 (48 teams × 26 players)")
    print(f"Difference: {len(players) - 1248:+d}")
    
    # Generate HTML datalist
    html = '<datalist id="player-list">\n'
    for player in players:
        # Escape HTML characters
        escaped = (player
                  .replace('&', '&amp;')
                  .replace('"', '&quot;')
                  .replace('<', '&lt;')
                  .replace('>', '&gt;'))
        html += f'  <option value="{escaped}">\n'
    html += '</datalist>'
    
    output_file = 'players_structured.html'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"\n✅ Generated {output_file}")
    
    # Show samples
    print(f"\nFirst 30 players:")
    for p in players[:30]:
        print(f"  - {p}")
    
    print(f"\nLast 30 players:")
    for p in players[-30:]:
        print(f"  - {p}")
    
    # Count how many are likely valid (have first and last name)
    multi_word = [p for p in players if len(p.split()) >= 2]
    print(f"\nPlayers with 2+ words (likely valid): {len(multi_word)}")

if __name__ == "__main__":
    main()
