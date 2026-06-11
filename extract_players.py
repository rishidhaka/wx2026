#!/usr/bin/env python3
"""
Extract all player names from ESPN World Cup 2026 squad lists
Generates datalist HTML for Golden Boot player autocomplete
Uses only Python standard library - no external dependencies
"""

import re
from html.parser import HTMLParser

class PlayerExtractor(HTMLParser):
    """Extract player names from ESPN squad HTML"""
    
    def __init__(self):
        super().__init__()
        self.players = set()
        self.current_text = []
        self.in_squad_section = False
        
    def handle_data(self, data):
        """Process text content"""
        data = data.strip()
        if data:
            self.current_text.append(data)
            
            # Look for player name patterns
            # ESPN format: "Player Name (Club/Position)"
            if '(' in data and ')' in data:
                match = re.match(r'^([A-ZÀ-ÿ][A-Za-zÀ-ÿ\'\-\.\s]+?)\s*\(', data)
                if match:
                    name = match.group(1).strip()
                    if self.is_valid_player_name(name):
                        self.players.add(name)
            
            # Also capture standalone names (2-4 words, properly capitalized)
            elif re.match(r'^[A-ZÀ-ÿ][A-Za-zÀ-ÿ\'\-\.]+(\s+[A-ZÀ-ÿ][A-Za-zÀ-ÿ\'\-\.]+){1,3}$', data):
                if self.is_valid_player_name(data):
                    self.players.add(data.strip())
    
    def is_valid_player_name(self, name):
        """Check if a string looks like a valid player name"""
        # Filter out common false positives
        invalid_names = {
            'Goalkeepers', 'Defenders', 'Midfielders', 'Forwards', 
            'Manager', 'Managers', 'Group', 'Team', 'Coach',
            'FIFA', 'World Cup', 'ESPN', 'United States', 'New Zealand'
        }
        
        if name in invalid_names:
            return False
        if len(name) < 3:
            return False
        if name.startswith('Group ') or name.startswith('Team '):
            return False
        if name.isupper() and len(name) > 10:  # Likely a heading
            return False
        if any(char.isdigit() for char in name):  # No numbers in names
            return False
            
        return True

def extract_players_from_html(html_file):
    """Parse HTML file and extract players"""
    with open(html_file, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    parser = PlayerExtractor()
    parser.feed(html_content)
    
    return sorted(parser.players)

def generate_datalist_html(players):
    """Generate HTML datalist with all players"""
    html = '<datalist id="player-list">\n'
    
    for player in players:
        # Escape special characters for HTML
        escaped_name = (player
                       .replace('&', '&amp;')
                       .replace('"', '&quot;')
                       .replace('<', '&lt;')
                       .replace('>', '&gt;'))
        html += f'  <option value="{escaped_name}">\n'
    
    html += '</datalist>'
    return html

def main():
    html_file = 'espn_squads.html'
    
    try:
        print(f"Parsing {html_file}...")
        players = extract_players_from_html(html_file)
        
        print(f"\n✅ Extracted {len(players)} unique players")
        
        if len(players) > 0:
            print(f"\nFirst 15 players (alphabetical):")
            for player in players[:15]:
                print(f"  - {player}")
            
            print(f"\nLast 15 players:")
            for player in players[-15:]:
                print(f"  - {player}")
        
        # Generate HTML
        datalist_html = generate_datalist_html(players)
        
        # Save to file
        output_file = 'player_datalist.html'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(datalist_html)
        
        print(f"\n✅ Generated {output_file} with {len(players)} players")
        print(f"\nTo update index.html:")
        print(f"1. Find the <datalist id=\"player-list\"> section around line 1548")
        print(f"2. Replace it with the content from {output_file}")
        
    except FileNotFoundError:
        print(f"❌ Error: {html_file} not found")
        print("Please run: curl -s 'https://www.espn.com/soccer/story/_/id/48757621/2026-world-cup-squad-lists-players-announced-all-48-teams' > espn_squads.html")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
