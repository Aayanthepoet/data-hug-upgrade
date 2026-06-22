export interface CompsSubject {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  year_built: number | null;
  property_type: string | null;
}

export interface CompRecord {
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  sale_price: number;
  sale_date: string; // YYYY-MM-DD
  distance_miles: number;
  sqft: number;
  beds: number;
  baths: number;
  year_built: number;
  property_type: string;
  similarity_score: number; // 0-100
  source_provider: string;
  source_record_id: string;
}

export interface CompsProvider {
  fetchComps(subject: CompsSubject, limit: number): Promise<CompRecord[]>;
}
