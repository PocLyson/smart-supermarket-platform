export interface CheckoutFieldErrors {
  pickupNameError: string
  phoneError: string
}

export const validateCheckoutFields = (
  pickupName: string,
  phone: string,
): CheckoutFieldErrors => ({
  pickupNameError: pickupName.trim() ? '' : '请填写取货人姓名',
  phoneError: /^1\d{10}$/.test(phone.trim())
    ? ''
    : '请输入正确的11位手机号',
})
