package com.prodent.dto.response;

import java.util.UUID;

public record SpecialtyResponse(
        UUID id,
        String nameRu,
        String nameUz,
        String nameEn,
        String slug,
        String icon
) {}
