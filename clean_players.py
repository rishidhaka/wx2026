#!/usr/bin/env python3
"""
Clean up extracted names to remove club names and keep only player names
"""

def clean_player_list(input_file, output_file):
    """Read HTML, filter out club names, write clean output"""
    
    # Common club name patterns to exclude
    # 
    club_keywords = {
        'FC', 'CF', 'AC', 'SC', 'AFC', 'AS', 'CD', 'RC', 'FK', 'SK', 'GD',
        'United', 'City', 'Wanderers', 'Rovers', 'Athletic', 'Sporting',
        'Real', 'Inter', 'Milan', 'Barcelona', 'Madrid', 'Bayern', 'Juventus',
        'Liverpool', 'Manchester', 'Chelsea', 'Arsenal', 'Tottenham',
        'PSG', 'Marseille', 'Lyon', 'Monaco', 'Paris', 'Saint-Germain',
        'Borussia', 'Leverkusen', 'Frankfurt', 'Stuttgart', 'Wolfsburg',
        'Ajax', 'PSV', 'Feyenoord', 'AZ', 'Alkmaar',
        'Benfica', 'Porto', 'Sporting', 'Braga',
        'Lazio', 'Roma', 'Napoli', 'Atalanta', 'Fiorentina', 'Torino',
        'Atletico', 'Sevilla', 'Valencia', 'Villarreal', 'Betis',
        'Zenit', 'Dynamo', 'Spartak', 'CSKA', 'Lokomotiv',
        'Galaxy', 'Revolution', 'Sounders', 'Timbers', 'Rapids',
        'Fenerbahce', 'Galatasaray', 'Besiktas',
        'Al-Hilal', 'Al-Nassr', 'Al-Ahly', 'Al-Ittihad',
        'Club', 'Olympic', 'Nacional', 'America', 'Guadalajara',
        'Flamengo', 'Palmeiras', 'Corinthians', 'Santos',
        'Boca', 'River', 'Racing', 'Independiente',
        'Celtic', 'Rangers', 'Hearts', 'Aberdeen',
        'Copenhagen', 'Brugge', 'Anderlecht', 'Standard', 'Genk',
        'Olympiacos', 'Panathinaikos', 'AEK', 'PAOK',
        'Waregem', 'Gent', 'Mechelen', 'Antwerp',
        'Auxerre', 'Reims', 'Toulouse', 'Montpellier', 'Rennes',
        'Bournemouth', 'Brighton', 'Palace', 'Newcastle', 'Everton',
        'Limassol', 'Kifisias', 'Macabi', 'Hapoel',
        'International', 'College', 'Academy', 'Institute'
    }
    
    clean_players = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract option values
    import re
    options = re.findall(r'<option value="([^"]+)">', content)
    
    for name in options:
        # Skip if it contains typical club keywords
        words = name.split()
        is_club = any(keyword in words or keyword in name for keyword in club_keywords)
        
        # Keep names that:
        # 1. Don't contain club keywords
        # 2. Are not all caps (usually acronyms)
        # 3. Have at least 2 words (first name + last name)
        # 4. Don't end with common club suffixes
        if (not is_club and 
            not (name.isupper() and len(name) > 4) and
            len(words) >= 2 and
            not name.endswith(('FC', 'SC', 'CF', 'United', 'City'))):
            clean_players.append(name)
    
    print(f"Before filtering: {len(options)} entries")
    print(f"After filtering: {len(clean_players)} players")
    
    # Generate clean HTML
    html = '<datalist id="player-list">\n'
    for player in sorted(clean_players):
        html += f'  <option value="{player}">\n'
    html += '</datalist>'
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"\n✅ Generated {output_file}")
    
    # Show samples
    sorted_players = sorted(clean_players)
    print(f"\nFirst 20 players:")
    for p in sorted_players[:20]:
        print(f"  - {p}")
    
    print(f"\nLast 20 players:")
    for p in sorted_players[-20:]:
        print(f"  - {p}")

if __name__ == "__main__":
    clean_player_list('player_datalist.html', 'player_datalist_clean.html')
