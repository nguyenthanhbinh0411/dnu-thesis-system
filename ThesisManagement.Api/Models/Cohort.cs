using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

namespace ThesisManagement.Api.Models
{
    public class Cohort
    {
        public int Id { get; set; }

        [Column("COHORT_CODE")]
        public string CohortCode { get; set; } = null!;

        [Column("COHORT_NAME")]
        public string CohortName { get; set; } = null!;

        [Column("START_YEAR")]
        public int StartYear { get; set; }

        [Column("END_YEAR")]
        public int EndYear { get; set; }

        public int Status { get; set; } = 1;

        [Column("CREATED_AT")]
        public DateTime? CreatedAt { get; set; }

        [Column("UPDATED_AT")]
        public DateTime? UpdatedAt { get; set; }
    }
}