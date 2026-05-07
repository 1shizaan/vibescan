// Two nearly identical functions — AI regenerated instead of reusing

async function fetchUserById(userId: string) {
  const response = await fetch(`/api/users/${userId}`)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  const data = await response.json()
  return data
}

async function fetchProductById(productId: string) {
  const response = await fetch(`/api/products/${productId}`)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  const data = await response.json()
  return data
}

// Magic numbers everywhere
function calculateDiscount(price: number) {
  if (price > 1000) {
    return price * 0.85
  } else if (price > 500) {
    return price * 0.90
  } else if (price > 250) {
    return price * 0.95
  }
  return price
}

// Mixing camelCase and snake_case
const user_name = 'john'
const userAge = 25
const user_email = 'john@example.com'
const userPhone = '555-1234'
