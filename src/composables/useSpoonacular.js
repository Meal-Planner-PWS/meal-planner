import axios from 'axios'

const API_KEY = import.meta.env.VITE_SPOONACULAR_KEY
const BASE_URL = 'https://api.spoonacular.com'

export function useSpoonacular() {
  async function findByIngredients(ingredients, number = 10) {
    const response = await axios.get(`${BASE_URL}/recipes/findByIngredients`, {
      params: {
        ingredients: ingredients.join(','),
        number,
        ranking: 1,
        ignorePantry: true,
        apiKey: API_KEY
      }
    })
    return response.data
  }

  async function getRecipeDetails(id) {
    const response = await axios.get(`${BASE_URL}/recipes/${id}/information`, {
      params: { apiKey: API_KEY }
    })
    return response.data
  }

  return { findByIngredients, getRecipeDetails }
}
