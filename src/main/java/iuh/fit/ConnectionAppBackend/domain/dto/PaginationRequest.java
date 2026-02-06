package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PaginationRequest {
    private int page = 0;
    private int size = 20;
    private String sortBy = "createdAt";
    private String sortDirection = "DESC";

    public int getPage() {
        return page < 0 ? 0 : page;
    }

    public int getSize() {
        return size <= 0 ? 20 : (size > 100 ? 100 : size);
    }
}
