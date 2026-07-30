# Validation

## Reference dataset

The committed BodyMaps case contains one CT and nine binary masks. All files are
NIfTI-1, little-endian, and use the same spatial grid.

- Matrix: `502 × 348 × 71`
- Header spacing: approximately `0.816406 × 0.816406 × 2.5 mm`
- Structures: aorta, gallbladder, both kidneys, liver, pancreas, inferior vena
  cava, spleen, and stomach

## Automated checks

`tests/sample-reference.test.ts` independently gunzips and parses the committed
NIfTI headers and voxel arrays. It does not ask NiiVue for the expected answer.
For every structure, it verifies:

- Exact dimensions and affine equality with the CT
- Exact nonzero voxel count
- Physical volume within `0.01 mL`
- Mean attenuation within `0.05 HU`

The pure statistics tests additionally cover:

- Orthogonal and sheared affines
- CT slope/intercept calibration
- Standard deviation and HU range
- Empty masks
- Non-finite CT samples
- CSV escaping

## Interpretation

Passing these checks demonstrates that the application's reported statistics
match the bundled reference data. It does not establish clinical efficacy,
diagnostic accuracy, regulatory compliance, or correctness for every possible
medical-image encoding.

Local input is rejected from quantitative analysis when a mask's dimensions or
affine do not match the CT. Future work may add explicit resampling after the
user selects an interpolation policy.
