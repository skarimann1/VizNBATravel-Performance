library(httr)
library(rvest)

url <- "https://www.prosportstransactions.com/basketball/Search/SearchResults.php?Player=&Team=&BeginDate=2010-01-01&EndDate=2024-12-31&ILChkBx=yes&Submit=Search"

page <- GET(
  url,
  user_agent("Mozilla/5.0")
)

html <- read_html(page)