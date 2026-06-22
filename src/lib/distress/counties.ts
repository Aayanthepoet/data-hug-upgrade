// Counties and (optional) representative ZIPs per state for filter UI + mock data.
// Featured Northeast markets get real county lists. Other states use a coarser
// default that still drives the dropdown.

export type CountyInfo = { name: string; zips?: string[]; lat?: number; lng?: number };

export const STATE_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  NY: { lat: 42.9, lng: -75.5, zoom: 7 },
  NJ: { lat: 40.2, lng: -74.5, zoom: 8 },
  CT: { lat: 41.6, lng: -72.7, zoom: 9 },
  PA: { lat: 40.9, lng: -77.5, zoom: 7 },
};

// Approximate county centroids for featured Northeast markets.
const C = (name: string, lat: number, lng: number, zips?: string[]): CountyInfo =>
  ({ name, lat, lng, zips });

export const COUNTIES_BY_STATE: Record<string, CountyInfo[]> = {
  NY: [
    C("New York (Manhattan)", 40.7831, -73.9712, ["10001","10011","10025","10027","10036"]),
    C("Kings (Brooklyn)", 40.6782, -73.9442, ["11201","11206","11215","11221","11233"]),
    C("Queens", 40.7282, -73.7949, ["11101","11354","11377","11385","11432"]),
    C("Bronx", 40.8448, -73.8648, ["10451","10458","10466","10472"]),
    C("Richmond (Staten Island)", 40.5795, -74.1502, ["10301","10314"]),
    C("Nassau", 40.7259, -73.5876, ["11501","11550","11553","11580"]),
    C("Suffolk", 40.9849, -72.6151, ["11701","11722","11757","11772"]),
    C("Westchester", 41.1220, -73.7949, ["10550","10701","10704"]),
    C("Erie (Buffalo)", 42.8864, -78.8784, ["14201","14207","14215","14221"]),
    C("Monroe (Rochester)", 43.1566, -77.6088, ["14605","14609","14621"]),
    C("Onondaga (Syracuse)", 43.0481, -76.1474, ["13202","13204","13208"]),
    C("Albany", 42.6526, -73.7562, ["12202","12206","12208"]),
  ],
  NJ: [
    C("Essex (Newark)", 40.7357, -74.1724, ["07102","07103","07106","07108","07112"]),
    C("Hudson (Jersey City)", 40.7282, -74.0776, ["07302","07304","07305","07306","07307"]),
    C("Bergen", 40.9266, -74.0771, ["07601","07631","07650","07670"]),
    C("Passaic (Paterson)", 40.9168, -74.1718, ["07501","07502","07503","07505"]),
    C("Union (Elizabeth)", 40.6640, -74.2107, ["07201","07202","07206","07208"]),
    C("Mercer (Trenton)", 40.2206, -74.7597, ["08608","08609","08611","08618"]),
    C("Camden", 39.9259, -75.1196, ["08102","08103","08104","08105"]),
    C("Atlantic", 39.3643, -74.4229, ["08401","08402","08405"]),
    C("Middlesex (Edison)", 40.5187, -74.4121, ["08817","08820","08837"]),
    C("Monmouth", 40.2871, -74.0496, ["07701","07712","07740"]),
    C("Ocean", 39.9537, -74.1979, ["08701","08742","08753"]),
    C("Burlington", 39.9779, -74.7290, ["08016","08054","08075"]),
  ],
  CT: [
    C("Fairfield (Bridgeport / Stamford)", 41.1865, -73.1952, ["06604","06606","06902","06850"]),
    C("New Haven", 41.3083, -72.9279, ["06511","06513","06515","06519"]),
    C("Hartford", 41.7658, -72.6734, ["06105","06106","06112","06120"]),
    C("New London", 41.3557, -72.0995, ["06320","06340","06360"]),
    C("Litchfield", 41.7470, -73.1898, ["06750","06790"]),
    C("Middlesex", 41.5623, -72.6506, ["06457","06480"]),
    C("Tolland", 41.8709, -72.3370, ["06066","06084"]),
    C("Windham", 41.7100, -72.0000, ["06226","06260"]),
  ],
  PA: [
    C("Philadelphia", 39.9526, -75.1652, ["19103","19121","19131","19139","19143","19146","19151"]),
    C("Allegheny (Pittsburgh)", 40.4406, -79.9959, ["15201","15206","15208","15212","15219"]),
    C("Montgomery", 40.2102, -75.3796, ["19401","19454","19462"]),
    C("Delaware", 39.9168, -75.3993, ["19013","19023","19082"]),
    C("Bucks", 40.3367, -75.1066, ["18901","18940","19020"]),
    C("Chester", 40.0040, -75.7466, ["19341","19380","19382"]),
    C("Lehigh (Allentown)", 40.6084, -75.4902, ["18101","18102","18103"]),
    C("Northampton (Bethlehem)", 40.6259, -75.3704, ["18015","18017","18042"]),
    C("Erie", 42.1292, -80.0851, ["16501","16503","16508"]),
    C("Berks (Reading)", 40.3357, -75.9269, ["19601","19604","19606"]),
    C("Lackawanna (Scranton)", 41.4090, -75.6624, ["18503","18505","18509"]),
    C("Dauphin (Harrisburg)", 40.2732, -76.8867, ["17101","17103","17109"]),
  ],
};

export function getCountiesForState(state: string): CountyInfo[] {
  return COUNTIES_BY_STATE[state.toUpperCase()] ?? [];
}
