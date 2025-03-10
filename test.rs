fn main() {
    let mut x = String::new();
    let y: i32 = "42";
    let result = some_fallible_operation().unwrap();
}

fn some_fallible_operation() -> Result<String, &'static str> {
    Ok("success".to_string())
}
