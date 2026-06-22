// Counties and (optional) representative ZIPs per state for filter UI + mock data.
// Featured Northeast markets get real county lists. Other states use a coarser
// default that still drives the dropdown.

export type CountyInfo = { name: string; zips?: string[] };

export const COUNTIES_BY_STATE: Record<string, CountyInfo[]> = {
  NY: [
    { name: "New York (Manhattan)", zips: ["10001","10011","10025","10027","10036"] },
    { name: "Kings (Brooklyn)", zips: ["11201","11206","11215","11221","11233"] },
    { name: "Queens", zips: ["11101","11354","11377","11385","11432"] },
    { name: "Bronx", zips: ["10451","10458","10466","10472"] },
    { name: "Richmond (Staten Island)", zips: ["10301","10314"] },
    { name: "Nassau", zips: ["11501","11550","11553","11580"] },
    { name: "Suffolk", zips: ["11701","11722","11757","11772"] },
    { name: "Westchester", zips: ["10550","10701","10704","10550"] },
    { name: "Erie (Buffalo)", zips: ["14201","14207","14215","14221"] },
    { name: "Monroe (Rochester)", zips: ["14605","14609","14621"] },
    { name: "Onondaga (Syracuse)", zips: ["13202","13204","13208"] },
    { name: "Albany", zips: ["12202","12206","12208"] },
  ],
  NJ: [
    { name: "Essex (Newark)", zips: ["07102","07103","07106","07108","07112"] },
    { name: "Hudson (Jersey City)", zips: ["07302","07304","07305","07306","07307"] },
    { name: "Bergen", zips: ["07601","07631","07650","07670"] },
    { name: "Passaic (Paterson)", zips: ["07501","07502","07503","07505"] },
    { name: "Union (Elizabeth)", zips: ["07201","07202","07206","07208"] },
    { name: "Mercer (Trenton)", zips: ["08608","08609","08611","08618"] },
    { name: "Camden", zips: ["08102","08103","08104","08105"] },
    { name: "Atlantic", zips: ["08401","08402","08405"] },
    { name: "Middlesex (Edison)", zips: ["08817","08820","08837"] },
    { name: "Monmouth", zips: ["07701","07712","07740"] },
    { name: "Ocean", zips: ["08701","08742","08753"] },
    { name: "Burlington", zips: ["08016","08054","08075"] },
  ],
  CT: [
    { name: "Fairfield (Bridgeport / Stamford)", zips: ["06604","06606","06902","06850"] },
    { name: "New Haven", zips: ["06511","06513","06515","06519"] },
    { name: "Hartford", zips: ["06105","06106","06112","06120"] },
    { name: "New London", zips: ["06320","06340","06360"] },
    { name: "Litchfield", zips: ["06750","06790"] },
    { name: "Middlesex", zips: ["06457","06480"] },
    { name: "Tolland", zips: ["06066","06084"] },
    { name: "Windham", zips: ["06226","06260"] },
  ],
  PA: [
    { name: "Philadelphia", zips: ["19103","19121","19131","19139","19143","19146","19151"] },
    { name: "Allegheny (Pittsburgh)", zips: ["15201","15206","15208","15212","15219"] },
    { name: "Montgomery", zips: ["19401","19454","19462"] },
    { name: "Delaware", zips: ["19013","19023","19082"] },
    { name: "Bucks", zips: ["18901","18940","19020"] },
    { name: "Chester", zips: ["19341","19380","19382"] },
    { name: "Lehigh (Allentown)", zips: ["18101","18102","18103"] },
    { name: "Northampton (Bethlehem)", zips: ["18015","18017","18042"] },
    { name: "Erie", zips: ["16501","16503","16508"] },
    { name: "Berks (Reading)", zips: ["19601","19604","19606"] },
    { name: "Lackawanna (Scranton)", zips: ["18503","18505","18509"] },
    { name: "Dauphin (Harrisburg)", zips: ["17101","17103","17109"] },
  ],
};

export function getCountiesForState(state: string): CountyInfo[] {
  return COUNTIES_BY_STATE[state.toUpperCase()] ?? [];
}
