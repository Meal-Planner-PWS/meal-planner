import axios from 'axios'

const BASE_URL = 'https://world.openfoodfacts.org/api/v2/product'

export function useOpenFoodFacts() {
  async function getProduct(barcode) {
    const response = await axios.get(`${BASE_URL}/${barcode}.json`)
    return response.data
  }

  return { getProduct }
}
