import math

def dimensionless_numbers(length_m: float, velocity_m_s: float, delta_temp_k: float,
                          temperature_k: float, gravity_m_s2: float,
                          nu_m2_s: float, alpha_m2_s: float, beta_1_k: float) -> dict:
    vals = [length_m, temperature_k, nu_m2_s, alpha_m2_s, beta_1_k]
    if any(v <= 0 for v in vals) or velocity_m_s < 0 or delta_temp_k < 0 or gravity_m_s2 < 0:
        raise ValueError("Length, temperature, viscosity, diffusivity and expansion coefficient must be positive; other inputs cannot be negative.")
    re = velocity_m_s * length_m / nu_m2_s
    gr = gravity_m_s2 * beta_1_k * delta_temp_k * length_m**3 / (nu_m2_s**2)
    pr = nu_m2_s / alpha_m2_s
    ra = gr * pr
    return {
        "reynolds": re, "grashof": gr, "prandtl": pr, "rayleigh": ra,
        "interpretation": "Dimensionless screening calculations only. They do not predict ignition, flame spread or spacecraft fire risk. Use fluid/material-specific properties and validate the flow regime."
    }
